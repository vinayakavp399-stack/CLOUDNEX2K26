import asyncio
from datetime import datetime, timedelta
import json
import logging
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.auth import decode_token
from app.config import settings
from app.database import db_manager
from app.models import UserRole
from app.routers import admin, auth, leaderboard, rounds, submissions
from app.seed_data import seed_database
from app.websocket_manager import ws_manager

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("cloudnex.main")

app = FastAPI(
    title="CLOUDNEX 2K26 — Racing-Themed Competition Portal API",
    description="Formula 1 themed Next-Gen Cloud Engineering Championship backend for GM University IGNITRON 2K26.",
    version="1.0.0",
    docs_url=f"{settings.API_V1_STR}/docs",
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all for development & preview
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount uploads directory for static asset access
app.mount("/static/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

# Include Routers under API_V1_STR
app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(rounds.router, prefix=settings.API_V1_STR)
app.include_router(submissions.router, prefix=settings.API_V1_STR)
app.include_router(admin.router, prefix=settings.API_V1_STR)
app.include_router(leaderboard.router, prefix=settings.API_V1_STR)


@app.get("/")
def root():
    return {
        "status": "online",
        "service": "CLOUDNEX 2K26 Racing Telemetry Engine API",
        "docs": f"{settings.API_V1_STR}/docs",
        "version": "1.0.0"
    }


@app.get("/health")
def health():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


def _check_round_deadlines_sync():
    rounds_col = db_manager.get_collection("rounds")
    problems_col = db_manager.get_collection("problem_statements")
    now = datetime.utcnow()
    live_rounds = list(rounds_col.find({"status": "LIVE"}))
    events_to_broadcast = []

    for r in live_rounds:
        deadline_str = r.get("deadline")
        if deadline_str:
            try:
                deadline_dt = datetime.fromisoformat(deadline_str.replace("Z", "+00:00")).replace(tzinfo=None)
                if now >= deadline_dt:
                    r_num = r.get("round_number")
                    logger.info(f"Round {r_num} time expired ({deadline_str}). Ending round.")
                    rounds_col.update_one(
                        {"round_number": r_num},
                        {"$set": {
                            "status": "CLOSED",
                            "is_active": False,
                            "updated_at": now.isoformat()
                        }}
                    )
                    events_to_broadcast.append(("ROUND_STATUS_CHANGED", {
                        "round_number": r_num,
                        "status": "CLOSED",
                        "is_active": False,
                        "deadline_expired": True
                    }))

                    # AUTOMATIC ROLLOVER: When 1st round timer gets over, automatically open 2nd round (3.30 hrs = 210 min)
                    if r_num == 1:
                        logger.info("Round 1 timer expired. Automatically starting Round 2 with 3.30 hrs (210 min) timer.")
                        r2_deadline = now + timedelta(minutes=210)
                        rounds_col.update_one(
                            {"round_number": 2},
                            {"$set": {
                                "status": "LIVE",
                                "is_active": True,
                                "start_time": now.isoformat(),
                                "deadline": r2_deadline.isoformat(),
                                "duration_minutes": 210,
                                "submissions_open": False,
                                "problem_published": True,
                                "updated_at": now.isoformat()
                            }}
                        )
                        problems_col.update_many({"round_number": 2}, {"$set": {"is_published": True, "updated_at": now.isoformat()}})
                        events_to_broadcast.append(("ROUND_STATUS_CHANGED", {
                            "round_number": 2,
                            "status": "LIVE",
                            "is_active": True,
                            "start_time": now.isoformat(),
                            "deadline": r2_deadline.isoformat(),
                            "duration_minutes": 210,
                            "submissions_open": False,
                            "problem_published": True,
                            "auto_started": True
                        }))
            except Exception as parse_err:
                logger.error(f"Error checking round deadline: {parse_err}")

    # Check winner announcement countdown timer
    try:
        settings_col = db_manager.get_collection("system_settings")
        winner_doc = settings_col.find_one({"key": "winner_announcement"})
        if winner_doc and winner_doc.get("is_timer_active") and winner_doc.get("announcement_time"):
            ann_dt = datetime.fromisoformat(winner_doc["announcement_time"].replace("Z", "+00:00")).replace(tzinfo=None)
            if now >= ann_dt:
                logger.info("Winner announcement timer expired. Publishing winners live across portals!")
                w_team, r_team = admin.compute_winner_and_runner_up()
                updated_winner = {
                    "key": "winner_announcement",
                    "is_announced": True,
                    "is_timer_active": False,
                    "announcement_time": None,
                    "held": False,
                    "winner": winner_doc.get("winner") or w_team,
                    "runner_up": winner_doc.get("runner_up") or r_team,
                    "updated_at": now.isoformat()
                }
                settings_col.update_one({"key": "winner_announcement"}, {"$set": updated_winner}, upsert=True)
                settings_col.update_one(
                    {"key": "leaderboard_config"},
                    {"$set": {"visibility_mode": "PUBLIC", "updated_at": now.isoformat()}},
                    upsert=True
                )
                events_to_broadcast.append(("WINNER_ANNOUNCEMENT_UPDATED", updated_winner))
                events_to_broadcast.append(("LEADERBOARD_SETTINGS_CHANGED", {"visibility_mode": "PUBLIC"}))
                events_to_broadcast.append(("LEADERBOARD_UPDATED", {"timestamp": now.isoformat()}))
    except Exception as w_err:
        logger.error(f"Error checking winner announcement timer: {w_err}")

    return events_to_broadcast


async def round_timer_monitor():
    """Background task checking round deadlines without blocking the asyncio event loop."""
    logger.info("Real-time round deadline monitor started.")
    while True:
        try:
            await asyncio.sleep(2)
            events = await asyncio.to_thread(_check_round_deadlines_sync)
            for event_type, payload in events:
                await ws_manager.broadcast(event_type, payload)
        except Exception as e:
            logger.error(f"Exception in round_timer_monitor: {e}")


@app.on_event("startup")
async def startup_event():
    logger.info("Initializing CLOUDNEX 2K26 Racing Championship Engine...")
    # Seed data on startup
    seed_database()
    logger.info("Ready for Green Flag racing!")
    # Start the continuous round deadline monitor
    asyncio.create_task(round_timer_monitor())


@app.get("/health")
async def health_check():
    return {
        "status": "GREEN_FLAG",
        "service": "CLOUDNEX 2K26 Engine",
        "engine": "FastAPI + MongoDB",
        "is_atlas": db_manager.is_atlas
    }


def _update_session_sync(team_id: str, active: bool):
    try:
        users_col = db_manager.get_collection("users")
        update_fields = {"active_session": active}
        if active:
            update_fields["last_active"] = datetime.utcnow().isoformat()
        users_col.update_one({"team_id": team_id}, {"$set": update_fields})
    except Exception:
        pass


async def update_session_async(team_id: str, active: bool):
    try:
        await asyncio.to_thread(_update_session_sync, team_id, active)
    except Exception:
        pass


# WebSocket handler for real-time race telemetry and round updates
async def handle_websocket(websocket: WebSocket, team_id: Optional[str] = None, token: Optional[str] = None):
    # If participant connects with a token, verify that their session is currently the active one
    sess_id = None
    if team_id and token:
        try:
            payload = decode_token(token)
            if payload and payload.get("role") == UserRole.PARTICIPANT:
                sess_id = payload.get("session_id")
                users_col = db_manager.get_collection("users")
                u = users_col.find_one({"team_id": team_id})
                active_token = u.get("active_session_token") if u else None
                if u and active_token and sess_id and active_token != sess_id:
                    # An older session was terminated by a newer login
                    await websocket.accept()
                    await websocket.send_text(json.dumps({
                        "type": "FORCE_LOGOUT",
                        "data": {"message": "Your session has been terminated because this account was logged into on another device."}
                    }))
                    await websocket.close(code=4001, reason="LOGGED_IN_ON_ANOTHER_DEVICE")
                    return
        except Exception as e:
            logger.debug(f"WebSocket token validation error: {e}")

    await ws_manager.connect(websocket, team_id=team_id)
    if team_id:
        asyncio.create_task(update_session_async(team_id, True))

    # Send initial welcome packet so client immediately confirms active link
    try:
        await websocket.send_text(json.dumps({
            "type": "CONNECTION_ESTABLISHED",
            "data": {
                "status": "ONLINE",
                "team_id": team_id,
                "server_time": datetime.utcnow().isoformat()
            }
        }))
    except Exception:
        pass

    try:
        while True:
            # Keep connection alive and receive client telemetry pings
            data = await websocket.receive_text()
            if data == "ping":
                # Check if session was superseded by another device in the meantime
                if team_id and sess_id:
                    try:
                        users_col = db_manager.get_collection("users")
                        u = users_col.find_one({"team_id": team_id})
                        if u and u.get("active_session_token") and u.get("active_session_token") != sess_id:
                            await websocket.send_text(json.dumps({
                                "type": "FORCE_LOGOUT",
                                "data": {"message": "Your session has been terminated because this account was logged into on another device."}
                            }))
                            await websocket.close(code=4001, reason="LOGGED_IN_ON_ANOTHER_DEVICE")
                            break
                    except Exception:
                        pass

                await websocket.send_text('{"type": "PONG"}')
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket, team_id=team_id)
    except Exception:
        ws_manager.disconnect(websocket, team_id=team_id)


@app.websocket("/ws")
async def websocket_ws(websocket: WebSocket, team_id: Optional[str] = None, token: Optional[str] = None):
    await handle_websocket(websocket, team_id=team_id, token=token)


@app.websocket("/api/v1/ws")
async def websocket_api_ws(websocket: WebSocket, team_id: Optional[str] = None, token: Optional[str] = None):
    await handle_websocket(websocket, team_id=team_id, token=token)

