import asyncio
from datetime import datetime, timedelta
import json
import logging
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, Query, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.auth import decode_token, check_participant_session
from app.config import settings
from app.database import db_manager
from app.models import UserRole
from app.routers import admin, auth, leaderboard, rounds, submissions
from app.seed_data import seed_database
from app.event_manager import event_manager, ws_manager

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
            await asyncio.sleep(4)
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


# HTTP Polling & Event Stream for real-time race telemetry (replaces WebSockets)
@app.get("/api/v1/events/poll")
@app.get("/events/poll")
async def poll_events(
    since: Optional[int] = Query(None, alias="since"),
    since_id: Optional[int] = Query(None, alias="since_id"),
    last_event_id: Optional[int] = Query(None, alias="last_event_id"),
    team_id: Optional[str] = Query(None),
    session_id: Optional[str] = Query(None),
    token: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None)
):
    """
    Lightweight, proxy-friendly HTTP telemetry polling endpoint.
    Returns real-time race events, round state changes, and session takeover alerts.
    """
    raw_token = token
    if not raw_token and authorization and authorization.startswith("Bearer "):
        raw_token = authorization.split(" ", 1)[1].strip()

    effective_team_id = team_id
    effective_session_id = session_id

    if raw_token:
        try:
            payload = decode_token(raw_token)
            if payload:
                if not effective_team_id and payload.get("team_id"):
                    effective_team_id = payload.get("team_id")
                if not effective_session_id and payload.get("session_id"):
                    effective_session_id = payload.get("session_id")
        except Exception:
            pass

    if effective_team_id:
        event_manager.record_heartbeat(effective_team_id)

    if effective_team_id and effective_session_id:
        try:
            if not check_participant_session(effective_team_id, effective_session_id):
                return {
                    "status": "ok",
                    "server_time": datetime.utcnow().isoformat(),
                    "last_event_id": event_manager.get_latest_event_id(),
                    "events": [{
                        "id": event_manager.get_latest_event_id(),
                        "type": "FORCE_LOGOUT",
                        "data": {
                            "message": "Your session has been terminated because this account was logged into on another device."
                        }
                    }]
                }
        except Exception as sess_err:
            logger.debug(f"Session validation error in poll: {sess_err}")

    effective_since = None
    if since_id is not None:
        effective_since = since_id
    elif since is not None:
        effective_since = since
    elif last_event_id is not None:
        effective_since = last_event_id

    events = event_manager.get_events(since_id=effective_since, team_id=effective_team_id)

    return {
        "status": "ok",
        "server_time": datetime.utcnow().isoformat(),
        "last_event_id": event_manager.get_latest_event_id(),
        "events": [
            {
                "id": e["id"],
                "type": e["type"],
                "data": e["data"],
                "timestamp": e.get("timestamp")
            }
            for e in events
        ]
    }




