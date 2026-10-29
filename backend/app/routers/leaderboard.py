import asyncio
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.auth import get_current_admin, get_optional_user
from app.database import db_manager
from app.models import UserRole
from app.websocket_manager import ws_manager

router = APIRouter(prefix="/leaderboard", tags=["Leaderboard & Standings"])

_WINNER_CACHE = None
_WINNER_CACHE_TS = 0
_WINNER_TTL = 2.0

def invalidate_winner_cache():
    global _WINNER_CACHE
    _WINNER_CACHE = None

class LeaderboardVisibilitySettings(BaseModel):
    visibility_mode: str = "LOCKED"  # LOCKED, PUBLIC, FROZEN, ADMIN_ONLY
    freeze_message: Optional[str] = "Standings are temporarily frozen before the podium ceremony."


@router.get("")
async def get_leaderboard(current_user: Optional[dict] = Depends(get_optional_user)):
    settings_col = db_manager.get_collection("system_settings")
    teams_col = db_manager.get_collection("teams")

    config = settings_col.find_one({"key": "leaderboard_config"})
    visibility = config.get("visibility_mode", "LOCKED") if config else "LOCKED"
    freeze_msg = config.get("freeze_message") if config else None

    is_admin = current_user and current_user.get("role") == UserRole.ADMIN

    rounds_col = db_manager.get_collection("rounds")
    r3_doc = rounds_col.find_one({"round_number": 3})
    r3_results_out = bool(r3_doc and r3_doc.get("results_announced"))

    # LOCKED: leaderboard not yet released by admin (default state until admin unlocks after R2 or R3 results announced)
    if visibility == "LOCKED" and not is_admin and not r3_results_out:
        return {
            "status": "LOCKED",
            "message": "The leaderboard will be revealed by the organizer after Round 2 evaluations are complete.",
            "standings": []
        }

    if visibility == "ADMIN_ONLY" and not is_admin:
        return {
            "status": "HIDDEN",
            "message": "The official standings are currently hidden by the organizer.",
            "standings": []
        }

    all_teams = teams_col.find()
    # Sort descending by total_score
    ranked = sorted(all_teams, key=lambda t: t.get("total_score", 0.0), reverse=True)

    standings = []
    for rank, t in enumerate(ranked, start=1):
        standings.append({
            "position": rank,
            "grid_position": rank,
            "team_id": t.get("team_id"),
            "team_name": t.get("team_name"),
            "leader_name": t.get("leader_name"),
            "institution": t.get("institution"),
            "status": t.get("status"),
            "is_qualified_r3": t.get("is_qualified_r3", False),
            "is_eliminated": t.get("is_eliminated", False),
            "total_score": round(t.get("total_score", 0.0), 2),
            "scores_by_round": t.get("scores_by_round", {}),
            "gap_to_leader": round(ranked[0].get("total_score", 0.0) - t.get("total_score", 0.0), 2) if ranked else 0.0
        })

    return {
        "status": "FROZEN" if visibility == "FROZEN" else "LIVE",
        "visibility_mode": visibility,
        "freeze_message": freeze_msg,
        "standings": standings
    }


@router.post("/settings")
async def update_leaderboard_settings(
    settings_payload: LeaderboardVisibilitySettings,
    current_admin: dict = Depends(get_current_admin)
):
    settings_col = db_manager.get_collection("system_settings")
    audit_col = db_manager.get_collection("audit_logs")

    doc = {
        "key": "leaderboard_config",
        "visibility_mode": settings_payload.visibility_mode,
        "freeze_message": settings_payload.freeze_message
    }

    existing = settings_col.find_one({"key": "leaderboard_config"})
    if existing:
        settings_col.update_one({"key": "leaderboard_config"}, {"$set": doc})
    else:
        settings_col.insert_one(doc)

    audit_col.insert_one({
        "action": "LEADERBOARD_VISIBILITY_UPDATED",
        "actor": current_admin["username"],
        "details": {"visibility_mode": settings_payload.visibility_mode},
        "timestamp": ""
    })

    await ws_manager.broadcast("LEADERBOARD_SETTINGS_CHANGED", {
        "visibility_mode": settings_payload.visibility_mode
    })

    return {"message": f"Leaderboard visibility set to {settings_payload.visibility_mode}."}


import time

@router.get("/winner-announcement")
async def get_public_winner_announcement():
    global _WINNER_CACHE, _WINNER_CACHE_TS
    now = datetime.utcnow().timestamp()
    if _WINNER_CACHE is not None and (now - _WINNER_CACHE_TS) < _WINNER_TTL:
        return _WINNER_CACHE

    settings_col = db_manager.get_collection("system_settings")
    doc = await asyncio.to_thread(settings_col.find_one, {"key": "winner_announcement"})
    if not doc:
        res = {
            "key": "winner_announcement",
            "is_announced": False,
            "is_timer_active": False,
            "announcement_time": None,
            "timer_seconds": 10,
            "held": False,
            "winner": None,
            "runner_up": None,
            "updated_at": None
        }
    else:
        res = {
            "key": "winner_announcement",
            "is_announced": bool(doc.get("is_announced", False)),
            "is_timer_active": bool(doc.get("is_timer_active", False)),
            "announcement_time": doc.get("announcement_time"),
            "timer_seconds": doc.get("timer_seconds", 10),
            "held": bool(doc.get("held", False)),
            "winner": doc.get("winner"),
            "runner_up": doc.get("runner_up"),
            "updated_at": doc.get("updated_at")
        }

    _WINNER_CACHE = res
    _WINNER_CACHE_TS = now
    return res

