import asyncio
from datetime import datetime, timedelta
import logging
import math
import random
import secrets
from typing import Any, Dict, List, Optional
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from app.auth import get_current_admin
from app.database import db_manager
from app.models import (
    AllocationConfigUpdate,
    AllocationResetRequest,
    BatchQualificationUpdate,
    EliminationDecision,
    EvaluationSubmit,
    ProblemStatementCreate,
    ProblemStatementModel,
    ProblemStatementUpdate,
    ResetEventRequest,
    RoundState,
    RoundStatusUpdate,
    TeamStatus,
    UserRole
)
from app.seed_data import seed_database
from app.websocket_manager import ws_manager

logger = logging.getLogger("cloudnex.admin")

router = APIRouter(prefix="/admin", tags=["Admin Control Center"])



def purge_test_grid_teams():
    """Purges any artificially generated test grid teams so only genuine registered teams appear."""
    try:
        teams_col = db_manager.get_collection("teams")
        # Quick exit if no test teams exist (avoids full table scan on every /overview request)
        if teams_col.count_documents({"team_id": {"$regex": "^TEAM-GRID-"}}) == 0:
            return

        users_col = db_manager.get_collection("users")
        allocations_col = db_manager.get_collection("allocations")
        submissions_col = db_manager.get_collection("submissions")
        evaluations_col = db_manager.get_collection("evaluations")

        all_teams = teams_col.find()
        grid_ids = [
            t.get("team_id") for t in all_teams 
            if t and isinstance(t.get("team_id"), str) and t.get("team_id").startswith("TEAM-GRID-")
        ]

        for tid in grid_ids:
            teams_col.delete_one({"team_id": tid})
            users_col.delete_one({"team_id": tid})
            users_col.delete_one({"username": tid.lower()})
            allocations_col.delete_many({"team_id": tid})
            submissions_col.delete_many({"team_id": tid})
            evaluations_col.delete_many({"team_id": tid})
    except Exception as e:
        logger.warning(f"Error purging test grid teams: {e}")



def get_winner_announcement_data():
    settings_col = db_manager.get_collection("system_settings")
    doc = settings_col.find_one({"key": "winner_announcement"})
    if not doc:
        return {
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
    return {
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


def format_announcement_team(t):
    if not t:
        return None
    return {
        "team_id": t.get("team_id"),
        "team_name": t.get("team_name"),
        "leader_name": t.get("leader_name"),
        "institution": t.get("institution") or "Championship Contender",
        "total_score": t.get("total_score", 0),
        "scores_by_round": t.get("scores_by_round", {})
    }


def find_announcement_team_by_id(team_identifier):
    if not team_identifier:
        return None
    teams_col = db_manager.get_collection("teams")
    t = teams_col.find_one({"team_id": str(team_identifier)})
    if not t:
        t = teams_col.find_one({"team_id": team_identifier})
    if not t:
        try:
            t = teams_col.find_one({"team_id": int(team_identifier)})
        except Exception:
            pass
    if not t:
        t = teams_col.find_one({"team_name": str(team_identifier)})
    return format_announcement_team(t)


def compute_winner_and_runner_up():
    teams_col = db_manager.get_collection("teams")
    all_teams = list(teams_col.find())
    if not all_teams:
        return None, None

    qualified = [t for t in all_teams if t.get("is_qualified_r3")]
    if not qualified:
        qualified = [t for t in all_teams if not t.get("is_eliminated")]
    if not qualified:
        qualified = all_teams

    def sort_key(t):
        scores = t.get("scores_by_round") or {}
        r3_score = -1.0
        if "3" in scores and scores["3"] is not None:
            try:
                r3_score = float(scores["3"])
            except Exception:
                r3_score = -1.0
        total = float(t.get("total_score") or 0.0)
        return (r3_score, total)

    sorted_teams = sorted(qualified, key=sort_key, reverse=True)
    winner = sorted_teams[0] if len(sorted_teams) > 0 else None
    runner_up = sorted_teams[1] if len(sorted_teams) > 1 else None

    # If only 1 team was in qualified, pick runner-up from remaining teams if available
    if not runner_up and winner and len(all_teams) > 1:
        remaining = [t for t in all_teams if str(t.get("team_id")) != str(winner.get("team_id"))]
        if remaining:
            remaining_sorted = sorted(remaining, key=lambda t: float(t.get("total_score") or 0.0), reverse=True)
            runner_up = remaining_sorted[0]

    return format_announcement_team(winner), format_announcement_team(runner_up)



@router.get("/overview")
async def get_admin_overview(current_admin: dict = Depends(get_current_admin)):
    purge_test_grid_teams()
    teams_col = db_manager.get_collection("teams")
    rounds_col = db_manager.get_collection("rounds")
    submissions_col = db_manager.get_collection("submissions")
    evaluations_col = db_manager.get_collection("evaluations")

    # Auto-seed rounds only if rounds collection is empty
    if rounds_col.count_documents({}) == 0:
        seed_database()

    all_teams = teams_col.find()
    total_teams = len(all_teams)
    active_teams = sum(1 for t in all_teams if not t.get("is_eliminated"))
    qualified_teams = sum(1 for t in all_teams if t.get("is_qualified_r3"))
    eliminated_teams = sum(1 for t in all_teams if t.get("is_eliminated"))

    raw_rounds = rounds_col.find()
    all_rounds = []
    for num in [1, 2, 3]:
        matching = [r for r in raw_rounds if int(r.get("round_number") or 0) == num]
        if matching:
            all_rounds.append(matching[0])
            for extra in matching[1:]:
                rounds_col.delete_one({"_id": extra.get("_id")})

    now = datetime.utcnow()
    # Check for any expired live round deadlines and auto-close
    for r in all_rounds:
        if r.get("status") == RoundState.LIVE and r.get("deadline"):
            try:
                deadline_dt = datetime.fromisoformat(r["deadline"].replace("Z", "+00:00")).replace(tzinfo=None)
                if now >= deadline_dt:
                    rounds_col.update_one(
                        {"round_number": r["round_number"]},
                        {"$set": {"status": RoundState.CLOSED, "is_active": False, "updated_at": now.isoformat()}}
                    )
                    r["status"] = RoundState.CLOSED
                    r["is_active"] = False

                    if r["round_number"] == 1:
                        r2_doc = rounds_col.find_one({"round_number": 2})
                        if r2_doc and r2_doc.get("status") not in [RoundState.LIVE, RoundState.CLOSED, RoundState.COMPLETED]:
                            r2_deadline = now + timedelta(minutes=210)
                            rounds_col.update_one(
                                {"round_number": 2},
                                {"$set": {
                                    "status": RoundState.LIVE,
                                    "is_active": True,
                                    "start_time": now.isoformat(),
                                    "deadline": r2_deadline.isoformat(),
                                    "duration_minutes": 210,
                                    "submissions_open": False,
                                    "problem_published": True,
                                    "updated_at": now.isoformat()
                                }}
                            )
            except Exception:
                pass

    live_rounds = [r for r in all_rounds if r.get("status") == RoundState.LIVE]
    current_live_round = live_rounds[0].get("round_number") if live_rounds else None

    # Submissions count per round
    subs_per_round = {1: 0, 2: 0, 3: 0}
    pending_evals_count = 0
    all_subs = submissions_col.find()
    for s in all_subs:
        r_num = s.get("round_number")
        if r_num in subs_per_round:
            subs_per_round[r_num] += 1
        if s.get("score") is None:
            pending_evals_count += 1

    # Upcoming deadlines
    deadlines = []
    for r in all_rounds:
        if r.get("deadline") and r.get("status") == RoundState.LIVE:
            deadlines.append({
                "round_number": r.get("round_number"),
                "title": r.get("title"),
                "deadline": r.get("deadline")
            })

    return {
        "total_teams": total_teams,
        "active_teams": active_teams,
        "qualified_teams": qualified_teams,
        "eliminated_teams": eliminated_teams,
        "current_live_round": current_live_round,
        "submissions_per_round": subs_per_round,
        "pending_evaluations": pending_evals_count,
        "upcoming_deadlines": deadlines,
        "rounds": all_rounds,
        "winner_announcement": get_winner_announcement_data()
    }


@router.post("/rounds/{round_number}/open")
async def open_round(
    round_number: int,
    deadline_minutes: Optional[int] = Query(None),
    publish_problem: bool = Query(True),
    current_admin: dict = Depends(get_current_admin)
):
    rounds_col = db_manager.get_collection("rounds")
    problems_col = db_manager.get_collection("problem_statements")
    audit_col = db_manager.get_collection("audit_logs")

    round_doc = rounds_col.find_one({"round_number": round_number})
    if not round_doc:
        raise HTTPException(status_code=404, detail="Round not found")

    now = datetime.utcnow()
    # Real Round Durations: Round 1 = 45 min, Round 2 = 3.30 hrs (210 min)
    if deadline_minutes is not None:
        mins = deadline_minutes
    elif round_number == 1:
        mins = 45
    elif round_number == 2:
        mins = 210  # 3 hours 30 minutes
    else:
        mins = 180
    deadline = now + timedelta(minutes=mins)

    # Ensure problem statements are distributed before Round 1 can be started
    if round_number == 1:
        allocations_col = db_manager.get_collection("allocations")
        teams_col = db_manager.get_collection("teams")
        num_allocs = allocations_col.count_documents({}) if hasattr(allocations_col, "count_documents") else len(allocations_col.find({}))
        num_assigned = teams_col.count_documents({"assigned_problem_id": {"$exists": True, "$ne": None, "$ne": ""}}) if hasattr(teams_col, "count_documents") else len([t for t in teams_col.find({}) if t.get("assigned_problem_id")])
        if num_allocs == 0 and num_assigned == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot start Round 1: Problem statements have not been distributed to teams yet. Please allocate problem statements in the 'Problem Allocation' tab before starting Round 1."
            )

    # Each round's status is managed independently and remains fixed
    is_reopen = round_doc.get("status") in [RoundState.CLOSED, RoundState.COMPLETED]
    pub = True if (publish_problem or round_doc.get("problem_published") or round_number in [1, 2]) else False
    sub_open = True if round_number in [1, 2] else False

    update_payload = {
        "status": RoundState.LIVE,
        "is_active": True,
        "start_time": now.isoformat(),
        "deadline": deadline.isoformat(),
        "duration_minutes": mins,
        "submissions_open": sub_open,
        "problem_published": pub,
        "updated_at": now.isoformat()
    }
    rounds_col.update_one({"round_number": round_number}, {"$set": update_payload})

    if pub:
        problems_col.update_many({"round_number": round_number}, {"$set": {"is_published": True, "updated_at": now.isoformat()}})

    # Audit log
    audit_col.insert_one({
        "action": "ROUND_REOPENED" if is_reopen else "ROUND_OPENED",
        "actor": current_admin["username"],
        "details": {"round_number": round_number, "deadline": deadline.isoformat(), "duration_minutes": mins, "is_reopen": is_reopen, "publish_problem": pub, "submissions_open": sub_open},
        "timestamp": now.isoformat()
    })

    # Broadcast live race event to all connected browsers
    await ws_manager.broadcast("ROUND_STATUS_CHANGED", {
        "round_number": round_number,
        "status": RoundState.LIVE,
        "is_active": True,
        "start_time": now.isoformat(),
        "deadline": deadline.isoformat(),
        "duration_minutes": mins,
        "submissions_open": sub_open,
        "problem_published": pub
    })

    duration_label = f"{mins} mins" if mins < 60 else f"{mins // 60}h {mins % 60}m"
    msg = f"Round {round_number} started live with {duration_label} timer!"
    return {
        "message": msg,
        "round_number": round_number,
        "status": RoundState.LIVE,
        "deadline": deadline.isoformat(),
        "duration_minutes": mins,
        "is_reopen": is_reopen
    }


@router.post("/rounds/{round_number}/reopen")
async def reopen_round(
    round_number: int,
    deadline_minutes: Optional[int] = Query(None),
    publish_problem: Optional[bool] = Query(True),
    current_admin: dict = Depends(get_current_admin)
):
    rounds_col = db_manager.get_collection("rounds")
    problems_col = db_manager.get_collection("problem_statements")
    audit_col = db_manager.get_collection("audit_logs")

    round_doc = rounds_col.find_one({"round_number": round_number})
    if not round_doc:
        raise HTTPException(status_code=404, detail="Round not found")

    now = datetime.utcnow()
    # Real Round Durations: Round 1 = 45 min, Round 2 = 3.30 hrs (210 min)
    if deadline_minutes is not None:
        mins = deadline_minutes
    elif round_number == 1:
        mins = 45
    elif round_number == 2:
        mins = 210  # 3 hours 30 minutes
    else:
        mins = 180
    deadline = now + timedelta(minutes=mins)

    # Ensure problem statements are distributed before Round 1 can be started
    if round_number == 1:
        allocations_col = db_manager.get_collection("allocations")
        teams_col = db_manager.get_collection("teams")
        num_allocs = allocations_col.count_documents({}) if hasattr(allocations_col, "count_documents") else len(allocations_col.find({}))
        num_assigned = teams_col.count_documents({"assigned_problem_id": {"$exists": True, "$ne": None, "$ne": ""}}) if hasattr(teams_col, "count_documents") else len([t for t in teams_col.find({}) if t.get("assigned_problem_id")])
        if num_allocs == 0 and num_assigned == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot start Round 1: Problem statements have not been distributed to teams yet. Please allocate problem statements in the 'Problem Allocation' tab before starting Round 1."
            )

    # Each round's status is managed independently and remains fixed
    pub = True if (publish_problem is True or round_doc.get("problem_published") or round_number in [1, 2]) else False
    sub_open = True if round_number in [1, 2] else False

    update_payload = {
        "status": RoundState.LIVE,
        "is_active": True,
        "start_time": now.isoformat(),
        "deadline": deadline.isoformat(),
        "duration_minutes": mins,
        "submissions_open": sub_open,
        "problem_published": pub,
        "updated_at": now.isoformat()
    }
    rounds_col.update_one({"round_number": round_number}, {"$set": update_payload})

    if pub:
        problems_col.update_many({"round_number": round_number}, {"$set": {"is_published": True, "updated_at": now.isoformat()}})

    # Audit log
    audit_col.insert_one({
        "action": "ROUND_REOPENED",
        "actor": current_admin["username"],
        "details": {"round_number": round_number, "deadline_minutes": mins, "new_deadline": deadline.isoformat(), "submissions_open": sub_open, "problem_published": pub},
        "timestamp": now.isoformat()
    })

    # Broadcast to all clients
    await ws_manager.broadcast("ROUND_STATUS_CHANGED", {
        "round_number": round_number,
        "status": RoundState.LIVE,
        "is_active": True,
        "start_time": now.isoformat(),
        "deadline": deadline.isoformat(),
        "duration_minutes": mins,
        "submissions_open": sub_open,
        "problem_published": pub
    })

    duration_label = f"{mins} mins" if mins < 60 else f"{mins // 60}h {mins % 60}m"
    return {
        "message": f"Round {round_number} started live with {duration_label} timer!",
        "round_number": round_number,
        "status": RoundState.LIVE,
        "deadline": deadline.isoformat(),
        "duration_minutes": mins
    }


@router.post("/rounds/{round_number}/close")
async def close_round(round_number: int, current_admin: dict = Depends(get_current_admin)):
    rounds_col = db_manager.get_collection("rounds")
    audit_col = db_manager.get_collection("audit_logs")

    round_doc = rounds_col.find_one({"round_number": round_number})
    if not round_doc:
        raise HTTPException(status_code=404, detail="Round not found")

    now = datetime.utcnow()
    update_payload = {
        "status": RoundState.CLOSED,
        "is_active": False,
        "submissions_open": False,
        "updated_at": now.isoformat()
    }
    rounds_col.update_one({"round_number": round_number}, {"$set": update_payload})

    # Audit log
    audit_col.insert_one({
        "action": "ROUND_CLOSED",
        "actor": current_admin["username"],
        "details": {"round_number": round_number},
        "timestamp": now.isoformat()
    })

    # Broadcast to all clients
    await ws_manager.broadcast("ROUND_STATUS_CHANGED", {
        "round_number": round_number,
        "status": RoundState.CLOSED,
        "is_active": False,
        "submissions_open": False
    })

    # Auto-open Round 2 when Round 1 completes
    if round_number == 1:
        r2_doc = rounds_col.find_one({"round_number": 2})
        if r2_doc and r2_doc.get("status") not in [RoundState.LIVE, RoundState.CLOSED, RoundState.COMPLETED]:
            r2_deadline = now + timedelta(minutes=210)
            rounds_col.update_one(
                {"round_number": 2},
                {"$set": {
                    "status": RoundState.LIVE,
                    "is_active": True,
                    "start_time": now.isoformat(),
                    "deadline": r2_deadline.isoformat(),
                    "duration_minutes": 210,
                    "submissions_open": False,
                    "problem_published": True,
                    "updated_at": now.isoformat()
                }}
            )
            problems_col = db_manager.get_collection("problem_statements")
            problems_col.update_many({"round_number": 2}, {"$set": {"is_published": True, "updated_at": now.isoformat()}})
            await ws_manager.broadcast("ROUND_STATUS_CHANGED", {
                "round_number": 2,
                "status": RoundState.LIVE,
                "is_active": True,
                "start_time": now.isoformat(),
                "deadline": r2_deadline.isoformat(),
                "duration_minutes": 210,
                "submissions_open": False,
                "problem_published": True
            })

    # Note: Round 3 does NOT start automatically. Admin must start it manually after announcing qualifiers.

    return {
        "message": f"Round {round_number} closed. Submissions are locked.",
        "round_number": round_number,
        "status": RoundState.CLOSED,
        "submissions_open": False
    }


@router.post("/rounds/{round_number}/submissions/toggle")
async def toggle_round_submissions(
    round_number: int,
    open: bool = Query(...),
    current_admin: dict = Depends(get_current_admin)
):
    rounds_col = db_manager.get_collection("rounds")
    audit_col = db_manager.get_collection("audit_logs")

    round_doc = rounds_col.find_one({"round_number": round_number})
    if not round_doc:
        raise HTTPException(status_code=404, detail="Round not found")

    now = datetime.utcnow()
    rounds_col.update_one(
        {"round_number": round_number},
        {"$set": {"submissions_open": open, "updated_at": now.isoformat()}}
    )

    audit_col.insert_one({
        "action": "ROUND_SUBMISSIONS_OPENED" if open else "ROUND_SUBMISSIONS_CLOSED",
        "actor": current_admin["username"],
        "details": {"round_number": round_number, "submissions_open": open},
        "timestamp": now.isoformat()
    })

    await ws_manager.broadcast("ROUND_STATUS_CHANGED", {
        "round_number": round_number,
        "status": round_doc.get("status"),
        "is_active": round_doc.get("is_active", False),
        "submissions_open": open
    })

    action_label = "OPEN" if open else "CLOSED"
    return {
        "message": f"Submissions for Round {round_number} are now {action_label}.",
        "round_number": round_number,
        "submissions_open": open,
        "status": round_doc.get("status")
    }


@router.post("/rounds/{round_number}/submissions/open")
async def open_round_submissions_endpoint(round_number: int, current_admin: dict = Depends(get_current_admin)):
    return await toggle_round_submissions(round_number=round_number, open=True, current_admin=current_admin)


@router.post("/rounds/{round_number}/submissions/close")
async def close_round_submissions_endpoint(round_number: int, current_admin: dict = Depends(get_current_admin)):
    return await toggle_round_submissions(round_number=round_number, open=False, current_admin=current_admin)



@router.post("/rounds/{round_number}/results-timer")
async def set_round_results_timer(
    round_number: int,
    seconds: Optional[int] = Query(None),
    minutes: Optional[int] = Query(None),
    action: str = Query("set"),
    current_admin: dict = Depends(get_current_admin)
):
    rounds_col = db_manager.get_collection("rounds")
    audit_col = db_manager.get_collection("audit_logs")

    round_doc = rounds_col.find_one({"round_number": round_number})
    if not round_doc:
        raise HTTPException(status_code=404, detail="Round not found")

    now = datetime.utcnow()
    now_iso = now.isoformat()

    if action == "clear":
        update_payload = {
            "results_announcement_time": None,
            "results_timer_active": False,
            "results_announced": False,
            "selection_revealed": False,
            "results_held": False,
            "updated_at": now_iso
        }
        rounds_col.update_one({"round_number": round_number}, {"$set": update_payload})
        msg = f"Round {round_number} results announcement timer cleared."

        audit_col.insert_one({
            "action": "ROUND_RESULTS_TIMER_CLEARED",
            "actor": current_admin["username"],
            "details": {"round_number": round_number},
            "timestamp": now_iso
        })

        broadcast_data = {
            "round_number": round_number,
            "results_announcement_time": None,
            "results_timer_active": False,
            "results_announced": False,
            "selection_revealed": False,
            "results_held": False,
            "timestamp": now_iso
        }
    elif action in ["hold", "conceal", "conceal_selection", "hide_selection"]:
        update_payload = {
            "results_announcement_time": None,
            "results_timer_active": False,
            "results_announced": False,
            "selection_revealed": False,
            "results_held": True,
            "updated_at": now_iso
        }
        rounds_col.update_one({"round_number": round_number}, {"$set": update_payload})
        msg = f"Round {round_number} selection is CONCEALED. Participants cannot see Round 3 selection results."

        audit_col.insert_one({
            "action": "ROUND_SELECTION_CONCEALED",
            "actor": current_admin["username"],
            "details": {"round_number": round_number, "selection_revealed": False, "results_held": True},
            "timestamp": now_iso
        })

        broadcast_data = {
            "round_number": round_number,
            "results_announcement_time": None,
            "results_timer_active": False,
            "results_announced": False,
            "selection_revealed": False,
            "results_held": True,
            "timestamp": now_iso
        }
    elif action in ["announce_now", "reveal", "reveal_selection"]:
        update_payload = {
            "results_announcement_time": None,
            "results_timer_active": False,
            "results_announced": True,
            "selection_revealed": True,
            "results_held": False,
            "updated_at": now_iso
        }
        rounds_col.update_one({"round_number": round_number}, {"$set": update_payload})
        msg = f"Round {round_number} results and selection are now officially announced live!"

        audit_col.insert_one({
            "action": "ROUND_RESULTS_ANNOUNCED",
            "actor": current_admin["username"],
            "details": {"round_number": round_number, "selection_revealed": True, "results_held": False},
            "timestamp": now_iso
        })

        broadcast_data = {
            "round_number": round_number,
            "results_announcement_time": None,
            "results_timer_active": False,
            "results_announced": True,
            "selection_revealed": True,
            "results_held": False,
            "timestamp": now_iso
        }

        # Also unlock the official leaderboard and standings for participants
        settings_col = db_manager.get_collection("system_settings")
        settings_col.update_one(
            {"key": "leaderboard_config"},
            {"$set": {"visibility_mode": "PUBLIC", "updated_at": now_iso}},
            upsert=True
        )
        await ws_manager.broadcast("LEADERBOARD_SETTINGS_CHANGED", {"visibility_mode": "PUBLIC"})
        await ws_manager.broadcast("LEADERBOARD_UPDATED", {"timestamp": now_iso})
    else:  # action == "set"
        if seconds is not None and seconds > 0:
            total_seconds = seconds
        elif minutes is not None and minutes > 0:
            total_seconds = minutes * 60
        else:
            total_seconds = 60

        target_time = now + timedelta(seconds=total_seconds)
        target_iso = target_time.strftime("%Y-%m-%dT%H:%M:%SZ")
        now_iso = now.strftime("%Y-%m-%dT%H:%M:%SZ")

        update_payload = {
            "results_announcement_time": target_iso,
            "results_timer_active": True,
            "results_announced": False,
            "selection_revealed": False,
            "results_held": False,
            "updated_at": now_iso
        }
        rounds_col.update_one({"round_number": round_number}, {"$set": update_payload})
        msg = f"Round {round_number} results announcement countdown scheduled for {total_seconds} seconds ({target_iso})."

        audit_col.insert_one({
            "action": "ROUND_RESULTS_TIMER_SET",
            "actor": current_admin["username"],
            "details": {"round_number": round_number, "seconds": total_seconds, "results_announcement_time": target_iso},
            "timestamp": now_iso
        })

        broadcast_data = {
            "round_number": round_number,
            "results_announcement_time": target_iso,
            "results_timer_active": True,
            "results_announced": False,
            "selection_revealed": False,
            "results_held": False,
            "timestamp": now_iso
        }

        # Auto-reveal background task when countdown ends
        async def auto_reveal_after_timer(delay_sec: int, expected_target: str, r_num: int):
            await asyncio.sleep(delay_sec)
            r_check = rounds_col.find_one({"round_number": r_num})
            if (
                r_check and
                r_check.get("results_timer_active") and
                r_check.get("results_announcement_time") == expected_target and
                not r_check.get("results_held")
            ):
                now_expire = datetime.utcnow()
                now_expire_iso = now_expire.strftime("%Y-%m-%dT%H:%M:%SZ")
                rounds_col.update_one(
                    {"round_number": r_num},
                    {"$set": {
                        "selection_revealed": True,
                        "results_announced": True,
                        "results_timer_active": False,
                        "updated_at": now_expire_iso
                    }}
                )
                auto_payload = {
                    "round_number": r_num,
                    "results_announcement_time": None,
                    "results_timer_active": False,
                    "results_announced": True,
                    "selection_revealed": True,
                    "results_held": False,
                    "timestamp": now_expire_iso
                }
                await ws_manager.broadcast("ROUND_3_RESULTS_TIMER", auto_payload)
                await ws_manager.broadcast("ROUND_STATUS_CHANGED", {
                    "round_number": r_num,
                    **auto_payload
                })

        asyncio.create_task(auto_reveal_after_timer(total_seconds, target_iso, round_number))

    # Broadcast real-time notifications to all active dashboards
    await ws_manager.broadcast("ROUND_3_RESULTS_TIMER", broadcast_data)
    await ws_manager.broadcast("ROUND_STATUS_CHANGED", {
        "round_number": round_number,
        **broadcast_data
    })

    return {
        "message": msg,
        "round_number": round_number,
        **broadcast_data
    }


@router.get("/winner-announcement")
async def get_admin_winner_announcement(current_admin: dict = Depends(get_current_admin)):
    return get_winner_announcement_data()


@router.post("/winner-announcement")
async def set_winner_announcement(
    action: str = Query("set"),
    seconds: Optional[int] = Query(10),
    winner_team_id: Optional[str] = Query(None),
    runner_up_team_id: Optional[str] = Query(None),
    current_admin: dict = Depends(get_current_admin)
):
    settings_col = db_manager.get_collection("system_settings")
    audit_col = db_manager.get_collection("audit_logs")
    now = datetime.utcnow()
    now_iso = now.isoformat()

    # Determine teams: custom specified takes priority, otherwise compute from leaderboard
    custom_winner = find_announcement_team_by_id(winner_team_id) if winner_team_id else None
    custom_runner_up = find_announcement_team_by_id(runner_up_team_id) if runner_up_team_id else None
    default_w, default_r = compute_winner_and_runner_up()

    final_winner = custom_winner or default_w
    final_runner_up = custom_runner_up or default_r

    if action == "announce_now":
        update_doc = {
            "key": "winner_announcement",
            "is_announced": True,
            "is_timer_active": False,
            "announcement_time": None,
            "held": False,
            "winner": final_winner,
            "runner_up": final_runner_up,
            "updated_at": now_iso
        }
        settings_col.update_one({"key": "winner_announcement"}, {"$set": update_doc}, upsert=True)
        # Also unlock official leaderboard so participants can celebrate
        settings_col.update_one(
            {"key": "leaderboard_config"},
            {"$set": {"visibility_mode": "PUBLIC", "updated_at": now_iso}},
            upsert=True
        )
        audit_col.insert_one({
            "action": "WINNER_ANNOUNCED_LIVE",
            "actor": current_admin["username"],
            "details": {"winner": final_winner, "runner_up": final_runner_up},
            "timestamp": now_iso
        })
        await ws_manager.broadcast("WINNER_ANNOUNCEMENT_UPDATED", update_doc)
        await ws_manager.broadcast("LEADERBOARD_SETTINGS_CHANGED", {"visibility_mode": "PUBLIC"})
        await ws_manager.broadcast("LEADERBOARD_UPDATED", {"timestamp": now_iso})
        return {"message": "Winner and 1st Runner Up published live across all portals!", **update_doc}

    elif action in ["hold", "hide", "conceal"]:
        update_doc = {
            "key": "winner_announcement",
            "is_announced": False,
            "is_timer_active": False,
            "announcement_time": None,
            "held": True,
            "updated_at": now_iso
        }
        settings_col.update_one({"key": "winner_announcement"}, {"$set": update_doc}, upsert=True)
        audit_col.insert_one({
            "action": "WINNER_ANNOUNCEMENT_CONCEALED",
            "actor": current_admin["username"],
            "details": {"held": True},
            "timestamp": now_iso
        })
        await ws_manager.broadcast("WINNER_ANNOUNCEMENT_UPDATED", update_doc)
        return {"message": "Winner announcement concealed / hidden.", **update_doc}

    elif action in ["clear", "reset"]:
        update_doc = {
            "key": "winner_announcement",
            "is_announced": False,
            "is_timer_active": False,
            "announcement_time": None,
            "held": False,
            "winner": None,
            "runner_up": None,
            "updated_at": now_iso
        }
        settings_col.update_one({"key": "winner_announcement"}, {"$set": update_doc}, upsert=True)
        audit_col.insert_one({
            "action": "WINNER_ANNOUNCEMENT_RESET",
            "actor": current_admin["username"],
            "details": {"reset": True},
            "timestamp": now_iso
        })
        await ws_manager.broadcast("WINNER_ANNOUNCEMENT_UPDATED", update_doc)
        return {"message": "Winner announcement reset to draft mode.", **update_doc}

    else:  # action == "set"
        total_seconds = seconds if (seconds is not None and seconds > 0) else 10
        target_time = now + timedelta(seconds=total_seconds)
        target_iso = target_time.strftime("%Y-%m-%dT%H:%M:%SZ")

        update_doc = {
            "key": "winner_announcement",
            "is_announced": False,
            "is_timer_active": True,
            "announcement_time": target_iso,
            "timer_seconds": total_seconds,
            "held": False,
            "winner": final_winner,
            "runner_up": final_runner_up,
            "updated_at": now_iso
        }
        settings_col.update_one({"key": "winner_announcement"}, {"$set": update_doc}, upsert=True)
        audit_col.insert_one({
            "action": "WINNER_ANNOUNCEMENT_TIMER_SET",
            "actor": current_admin["username"],
            "details": {"seconds": total_seconds, "announcement_time": target_iso, "winner": final_winner, "runner_up": final_runner_up},
            "timestamp": now_iso
        })

        async def auto_announce_winner_after_timer(wait_sec, exp_target_iso):
            await asyncio.sleep(wait_sec)
            cur = settings_col.find_one({"key": "winner_announcement"})
            if cur and cur.get("is_timer_active") and not cur.get("is_announced") and not cur.get("held"):
                now_ann = datetime.utcnow().isoformat()
                ann_doc = {
                    "key": "winner_announcement",
                    "is_announced": True,
                    "is_timer_active": False,
                    "announcement_time": None,
                    "held": False,
                    "winner": cur.get("winner") or final_winner,
                    "runner_up": cur.get("runner_up") or final_runner_up,
                    "updated_at": now_ann
                }
                settings_col.update_one({"key": "winner_announcement"}, {"$set": ann_doc}, upsert=True)
                settings_col.update_one(
                    {"key": "leaderboard_config"},
                    {"$set": {"visibility_mode": "PUBLIC", "updated_at": now_ann}},
                    upsert=True
                )
                await ws_manager.broadcast("WINNER_ANNOUNCEMENT_UPDATED", ann_doc)
                await ws_manager.broadcast("LEADERBOARD_SETTINGS_CHANGED", {"visibility_mode": "PUBLIC"})
                await ws_manager.broadcast("LEADERBOARD_UPDATED", {"timestamp": now_ann})

        asyncio.create_task(auto_announce_winner_after_timer(total_seconds, target_iso))

        await ws_manager.broadcast("WINNER_ANNOUNCEMENT_UPDATED", update_doc)
        return {"message": f"Winner announcement countdown scheduled for {total_seconds} seconds.", **update_doc}


@router.post("/rounds/{round_number}/publish-problems")
async def publish_round_problems(round_number: int, current_admin: dict = Depends(get_current_admin)):
    rounds_col = db_manager.get_collection("rounds")
    problems_col = db_manager.get_collection("problem_statements")
    audit_col = db_manager.get_collection("audit_logs")

    round_doc = rounds_col.find_one({"round_number": round_number})
    if not round_doc:
        raise HTTPException(status_code=404, detail="Round not found")

    now_iso = datetime.utcnow().isoformat()

    # Mark rounds 1 and 2 as problem_published (same problem statement pool)
    rounds_col.update_many({"round_number": {"$in": [1, 2]}}, {"$set": {"problem_published": True, "updated_at": now_iso}})

    # Mark all problem statements as published
    problems_col.update_many({}, {"$set": {"is_published": True, "updated_at": now_iso}})

    # Audit log
    audit_col.insert_one({
        "action": "PROBLEM_STATEMENTS_PUBLISH_APPROVED",
        "actor": current_admin["username"],
        "details": {"round_number": round_number, "is_published": True},
        "timestamp": now_iso
    })

    # Broadcast real-time notifications to all connected clients
    for r_n in [1, 2]:
        await ws_manager.broadcast("PROBLEM_PUBLISHED", {
            "round_number": r_n,
            "problem_published": True,
            "timestamp": now_iso
        })
        await ws_manager.broadcast("ROUND_STATUS_CHANGED", {
            "round_number": r_n,
            "problem_published": True,
            "timestamp": now_iso
        })

    return {
        "message": f"Problem statements for Round {round_number} approved and published to all eligible participants!",
        "round_number": round_number,
        "problem_published": True
    }


@router.post("/rounds/{round_number}/unpublish-problems")
async def unpublish_round_problems(round_number: int, current_admin: dict = Depends(get_current_admin)):
    rounds_col = db_manager.get_collection("rounds")
    problems_col = db_manager.get_collection("problem_statements")
    audit_col = db_manager.get_collection("audit_logs")

    round_doc = rounds_col.find_one({"round_number": round_number})
    if not round_doc:
        raise HTTPException(status_code=404, detail="Round not found")

    now_iso = datetime.utcnow().isoformat()

    # Mark rounds 1 and 2 as not published
    rounds_col.update_many({"round_number": {"$in": [1, 2]}}, {"$set": {"problem_published": False, "updated_at": now_iso}})

    # Mark all problem statements as unpublished
    problems_col.update_many({}, {"$set": {"is_published": False, "updated_at": now_iso}})

    # Audit log
    audit_col.insert_one({
        "action": "PROBLEM_STATEMENTS_UNPUBLISHED",
        "actor": current_admin["username"],
        "details": {"round_number": round_number, "is_published": False},
        "timestamp": now_iso
    })

    # Broadcast status change to re-lock view on participant dashboards
    for r_n in [1, 2]:
        await ws_manager.broadcast("PROBLEM_PUBLISHED", {
            "round_number": r_n,
            "problem_published": False,
            "timestamp": now_iso
        })
        await ws_manager.broadcast("ROUND_STATUS_CHANGED", {
            "round_number": r_n,
            "problem_published": False,
            "timestamp": now_iso
        })
    await ws_manager.broadcast("PROBLEM_UNPUBLISHED", {
        "round_number": round_number,
        "timestamp": now_iso
    })

    return {
        "message": f"Problem statements for Round {round_number} unpublished. Problem content is now confidential.",
        "round_number": round_number,
        "problem_published": False
    }


@router.put("/rounds/{round_number}/problem")
async def update_round_problem(
    round_number: int,
    problem_update: ProblemStatementUpdate,
    current_admin: dict = Depends(get_current_admin)
):
    problems_col = db_manager.get_collection("problem_statements")
    rounds_col = db_manager.get_collection("rounds")
    audit_col = db_manager.get_collection("audit_logs")

    allowed_fields = {
        "title", "tagline", "scenario", "description",
        "functional_requirements", "technical_constraints",
        "deliverables", "evaluation_criteria", "max_capacity", "is_published"
    }
    update_dict = {k: v for k, v in problem_update.dict().items() if v is not None and k in allowed_fields}
    now = datetime.utcnow().isoformat()
    existing = problems_col.find_one({"round_number": round_number})

    if existing:
        problems_col.update_one({"_id": existing["_id"]}, {"$set": update_dict})
    else:
        update_dict["round_number"] = round_number
        problems_col.insert_one(update_dict)

    if problem_update.is_published is not None:
        rounds_col.update_one({"round_number": round_number}, {"$set": {"problem_published": problem_update.is_published}})


    # Broadcast if published
    if problem_update.is_published:
        await ws_manager.broadcast("PROBLEM_PUBLISHED", {
            "round_number": round_number,
            "title": problem_update.title or (existing.get("title") if existing else "")
        })

    return {"message": f"Problem statement for Round {round_number} updated successfully."}


@router.get("/teams")
async def get_all_teams_admin(current_admin: dict = Depends(get_current_admin)):
    purge_test_grid_teams()
    teams_col = db_manager.get_collection("teams")
    submissions_col = db_manager.get_collection("submissions")
    users_col = db_manager.get_collection("users")

    # Teams should never be auto-seeded; an empty grid is completely valid until participants register.
    teams = teams_col.find()
    all_subs = submissions_col.find()
    all_users = users_col.find({"role": UserRole.PARTICIPANT})
    users_by_team = {u.get("team_id"): u for u in all_users if u.get("team_id")}

    result = []
    for t in teams:
        t_copy = dict(t)
        t_id = t.get("team_id")
        t_subs = [s for s in all_subs if s.get("team_id") == t_id]
        t_copy["submissions_count"] = len(t_subs)
        t_copy["submitted_rounds"] = [s.get("round_number") for s in t_subs]

        # Live session and connection status
        user_info = users_by_team.get(t_id) or {}
        has_active_db_session = bool(user_info.get("active_session") and user_info.get("active_session_token"))
        has_active_ws = bool(t_id and t_id in ws_manager.team_connections and len(ws_manager.team_connections[t_id]) > 0)

        t_copy["is_online"] = has_active_db_session or has_active_ws
        t_copy["email"] = t.get("email") or user_info.get("email", "")
        raw_reg = t.get("registered_at") or t.get("created_at") or user_info.get("created_at") or ""
        if raw_reg and isinstance(raw_reg, str) and not raw_reg.endswith("Z") and "+" not in raw_reg:
            raw_reg += "Z"
        t_copy["registered_at"] = raw_reg
        t_copy["created_at"] = raw_reg
        t_copy["last_active"] = user_info.get("last_active") or ""
        t_copy["leader_name"] = t.get("leader_name") or user_info.get("full_name") or ""
        t_copy["user_id"] = user_info.get("id") or ""
        result.append(t_copy)

    # Sort by total_score descending
    return sorted(result, key=lambda x: float(x.get("total_score") or 0.0), reverse=True)


@router.post("/teams/{team_id}/logout")
async def force_logout_team_admin(
    team_id: str,
    current_admin: dict = Depends(get_current_admin)
):
    users_col = db_manager.get_collection("users")
    user = users_col.find_one({"team_id": team_id})
    if not user:
        raise HTTPException(status_code=404, detail=f"Team {team_id} account not found.")

    # 1. Clear session in DB
    users_col.update_one(
        {"team_id": team_id},
        {"$set": {"active_session": False, "active_session_token": None}}
    )

    # 2. Invalidate cache
    try:
        from app.auth import invalidate_user_cache
        invalidate_user_cache(user["id"])
    except Exception:
        pass

    # 3. Notify team websocket with FORCE_LOGOUT packet
    try:
        await ws_manager.send_team_message(team_id, "FORCE_LOGOUT", {
            "message": "Your session has been terminated by the Race Director / Administrator.",
            "reason": "ADMIN_FORCED_LOGOUT"
        })
    except Exception:
        pass

    # 4. Forcefully disconnect active sockets
    try:
        await ws_manager.close_team_connections(team_id, reason="ADMIN_FORCED_LOGOUT")
    except Exception:
        pass

    # 5. Broadcast status update to all connected admins and monitors
    try:
        await ws_manager.broadcast("TEAM_STATUS_CHANGED", {
            "team_id": team_id,
            "is_online": False,
            "action": "FORCE_LOGOUT"
        })
    except Exception:
        pass

    return {"message": f"Team {team_id} successfully logged out.", "team_id": team_id, "is_online": False}



@router.get("/submissions")
async def get_all_submissions_admin(
    round_number: Optional[int] = None,
    current_admin: dict = Depends(get_current_admin)
):
    submissions_col = db_manager.get_collection("submissions")
    filter_dict = {}
    if round_number:
        filter_dict["round_number"] = round_number
    return submissions_col.find(filter_dict)


@router.get("/evaluations")
async def get_all_evaluations_admin(
    round_number: Optional[int] = None,
    current_admin: dict = Depends(get_current_admin)
):
    evaluations_col = db_manager.get_collection("evaluations")
    filter_dict = {}
    if round_number:
        filter_dict["round_number"] = round_number
    return evaluations_col.find(filter_dict)


@router.post("/evaluations")
async def evaluate_submission(
    evaluation: EvaluationSubmit,
    current_admin: dict = Depends(get_current_admin)
):
    submissions_col = db_manager.get_collection("submissions")
    evaluations_col = db_manager.get_collection("evaluations")
    teams_col = db_manager.get_collection("teams")
    audit_col = db_manager.get_collection("audit_logs")

    # Calculate score based on round rubrics
    if evaluation.round_number == 1 and (evaluation.architecture_design is not None or evaluation.service_selection is not None):
        base_score = (
            float(evaluation.architecture_design or 0.0) +
            float(evaluation.service_selection or 0.0) +
            float(evaluation.scalability_performance or 0.0) +
            float(evaluation.security_protection or 0.0) +
            float(evaluation.high_availability or 0.0) +
            float(evaluation.cost_optimization or 0.0) +
            float(evaluation.technical_feasibility or 0.0)
        )
        final_score = base_score
    elif evaluation.round_number == 2 and (evaluation.app_functionality is not None or evaluation.cloud_deployment is not None):
        base_score = (
            float(evaluation.app_functionality or 0.0) +
            float(evaluation.cloud_deployment or 0.0) +
            float(evaluation.database_integration or 0.0) +
            float(evaluation.containerization or 0.0) +
            float(evaluation.auth_security or 0.0) +
            float(evaluation.object_storage or 0.0) +
            float(evaluation.monitoring_logging or 0.0) +
            float(evaluation.reliability_error_handling or 0.0) +
            float(evaluation.cloud_config_management or 0.0)
        )
        final_score = base_score
    elif evaluation.round_number == 3 and (evaluation.crisis_challenge is not None or evaluation.presentation is not None):
        base_score = (
            float(evaluation.crisis_challenge or 0.0) +
            float(evaluation.presentation or 0.0)
        )
        final_score = base_score
    else:
        base_score = (
            float(evaluation.innovation_score or 0.0) +
            float(evaluation.functionality_score or 0.0) +
            float(evaluation.scalability_score or 0.0) +
            float(evaluation.crisis_handling_score or 0.0) +
            float(evaluation.presentation_score or 0.0)
        )
        final_score = base_score + (float(evaluation.blockchain_bonus or 0.0) if evaluation.include_bonus else 0.0)

    now = datetime.utcnow().isoformat()
    eval_doc = {
        "submission_id": evaluation.submission_id,
        "team_id": evaluation.team_id,
        "round_number": evaluation.round_number,
        # Round 1 Specific Rubrics (50 Marks Total)
        "architecture_design": evaluation.architecture_design,
        "service_selection": evaluation.service_selection,
        "scalability_performance": evaluation.scalability_performance,
        "security_protection": evaluation.security_protection,
        "high_availability": evaluation.high_availability,
        "cost_optimization": evaluation.cost_optimization,
        "technical_feasibility": evaluation.technical_feasibility,
        # Round 2 Specific Rubrics (100 Marks Total)
        "app_functionality": evaluation.app_functionality,
        "cloud_deployment": evaluation.cloud_deployment,
        "database_integration": evaluation.database_integration,
        "containerization": evaluation.containerization,
        "auth_security": evaluation.auth_security,
        "object_storage": evaluation.object_storage,
        "monitoring_logging": evaluation.monitoring_logging,
        "reliability_error_handling": evaluation.reliability_error_handling,
        "cloud_config_management": evaluation.cloud_config_management,
        # Round 3 Specific Rubrics (50 Marks Total)
        "crisis_challenge": evaluation.crisis_challenge,
        "presentation": evaluation.presentation,
        # Generic / Fallback Rubrics
        "innovation_score": evaluation.innovation_score,
        "functionality_score": evaluation.functionality_score,
        "scalability_score": evaluation.scalability_score,
        "crisis_handling_score": evaluation.crisis_handling_score,
        "presentation_score": evaluation.presentation_score,
        "blockchain_bonus": evaluation.blockchain_bonus,
        "include_bonus": evaluation.include_bonus,
        "base_score": round(base_score, 2),
        "total_score": round(final_score, 2),
        "feedback": evaluation.feedback,
        "evaluated_by": current_admin["username"],
        "evaluated_at": now
    }

    # Store or update evaluation
    existing_eval = evaluations_col.find_one({"team_id": evaluation.team_id, "round_number": evaluation.round_number})
    if existing_eval:
        evaluations_col.update_one({"team_id": evaluation.team_id, "round_number": evaluation.round_number}, {"$set": eval_doc})
    else:
        evaluations_col.insert_one(eval_doc)

    # Update submission record
    submissions_col.update_one(
        {"team_id": evaluation.team_id, "round_number": evaluation.round_number},
        {"$set": {"score": round(final_score, 2), "feedback": evaluation.feedback}}
    )

    # Recompute team total score across all rounds
    all_team_evals = evaluations_col.find({"team_id": evaluation.team_id})
    scores_by_round = {}
    total = 0.0
    for ev in all_team_evals:
        r_num = str(ev.get("round_number"))
        sc = ev.get("total_score", 0.0)
        scores_by_round[r_num] = sc
        total += sc

    teams_col.update_one(
        {"team_id": evaluation.team_id},
        {"$set": {"total_score": round(total, 2), "scores_by_round": scores_by_round}}
    )

    # Audit log
    audit_col.insert_one({
        "action": "EVALUATION_RECORDED",
        "actor": current_admin["username"],
        "details": {"team_id": evaluation.team_id, "round_number": evaluation.round_number, "score": final_score},
        "timestamp": now
    })

    # Broadcast live leaderboard refresh
    await ws_manager.broadcast("LEADERBOARD_UPDATED", {"team_id": evaluation.team_id, "new_total": round(total, 2)})

    return {
        "message": f"Evaluation for team {evaluation.team_id} (Round {evaluation.round_number}) saved successfully!",
        "score": round(final_score, 2),
        "total_team_score": round(total, 2)
    }


@router.post("/elimination/qualify")
async def update_qualifications(
    payload: BatchQualificationUpdate,
    current_admin: dict = Depends(get_current_admin)
):
    teams_col = db_manager.get_collection("teams")
    audit_col = db_manager.get_collection("audit_logs")
    now = datetime.utcnow().isoformat()

    updated = []
    for item in payload.qualifications:
        team_id = item.team_id
        if item.qualified:
            status_val = TeamStatus.QUALIFIED_FOR_FINAL
            teams_col.update_one(
                {"team_id": team_id},
                {"$set": {
                    "is_qualified_r3": True,
                    "is_eliminated": False,
                    "status": status_val,
                    "director_feedback": item.feedback or "Qualified for Round 3 (Final Lap). Congratulations!"
                }}
            )
        else:
            status_val = TeamStatus.ELIMINATED
            teams_col.update_one(
                {"team_id": team_id},
                {"$set": {
                    "is_qualified_r3": False,
                    "is_eliminated": True,
                    "status": status_val,
                    "director_feedback": item.feedback or "Race completed. Thank you for participating in CLOUDNEX 2K26."
                }}
            )
        updated.append({"team_id": team_id, "qualified": item.qualified})

    audit_col.insert_one({
        "action": "QUALIFICATION_DECISION_APPLIED",
        "actor": current_admin["username"],
        "details": {"teams_count": len(updated)},
        "timestamp": now
    })

    # Note: Qualifications remain sealed. Results are only revealed to participants when admin starts the announcement timer or clicks reveal in Round Control.
    rounds_col = db_manager.get_collection("rounds")
    r3 = rounds_col.find_one({"round_number": 3})
    if r3 and not r3.get("results_timer_active") and not r3.get("results_announced"):
        rounds_col.update_one(
            {"round_number": 3},
            {"$set": {"selection_revealed": False, "results_announced": False}}
        )

    return {
        "message": f"Successfully updated qualification decisions for {len(updated)} teams.",
        "results": updated
    }


@router.get("/audit-logs")
async def get_audit_logs(limit: int = Query(50), current_admin: dict = Depends(get_current_admin)):
    return []


# =========================================================================
# AI-ASSISTED AUTOMATIC PROBLEM STATEMENT ALLOCATION ENGINE
# =========================================================================

@router.get("/allocation/config")
async def get_allocation_config(current_admin: dict = Depends(get_current_admin)):
    config_col = db_manager.get_collection("allocation_config")
    cfg = config_col.find_one({"_id": "global_allocation_config"})
    if not cfg:
        cfg = {
            "_id": "global_allocation_config",
            "is_automatic_enabled": True,
            "max_teams_per_problem": 5,
            "allocation_deadline": None,
            "is_finalized": False,
            "batch_id": None,
            "last_allocated_at": None,
            "updated_at": datetime.utcnow().isoformat()
        }
        config_col.insert_one(cfg)
    return cfg


@router.post("/allocation/config")
async def update_allocation_config(payload: AllocationConfigUpdate, current_admin: dict = Depends(get_current_admin)):
    config_col = db_manager.get_collection("allocation_config")
    audit_col = db_manager.get_collection("audit_logs")

    cfg = config_col.find_one({"_id": "global_allocation_config"})
    if not cfg:
        cfg = {
            "_id": "global_allocation_config",
            "is_automatic_enabled": True,
            "max_teams_per_problem": 5,
            "allocation_deadline": None,
            "is_finalized": False,
            "batch_id": None,
            "last_allocated_at": None
        }
        config_col.insert_one(cfg)

    update_data = {}
    if payload.max_teams_per_problem is not None:
        if payload.max_teams_per_problem < 1:
            raise HTTPException(400, "Maximum teams per problem statement must be at least 1.")
        update_data["max_teams_per_problem"] = payload.max_teams_per_problem
    if payload.is_automatic_enabled is not None:
        update_data["is_automatic_enabled"] = payload.is_automatic_enabled
    if payload.allocation_deadline is not None:
        update_data["allocation_deadline"] = payload.allocation_deadline

    now_iso = datetime.utcnow().isoformat()
    update_data["updated_at"] = now_iso
    config_col.update_one({"_id": "global_allocation_config"}, {"$set": update_data})

    audit_col.insert_one({
        "action": "ALLOCATION_CONFIG_UPDATED",
        "actor": current_admin["username"],
        "details": update_data,
        "timestamp": now_iso
    })

    return config_col.find_one({"_id": "global_allocation_config"})


@router.get("/allocation/stats")
async def get_allocation_stats(current_admin: dict = Depends(get_current_admin)):
    purge_test_grid_teams()
    teams_col = db_manager.get_collection("teams")
    problems_col = db_manager.get_collection("problem_statements")
    config_col = db_manager.get_collection("allocation_config")
    allocations_col = db_manager.get_collection("allocations")

    cfg = config_col.find_one({"_id": "global_allocation_config"}) or {
        "is_automatic_enabled": True,
        "max_teams_per_problem": 5,
        "is_finalized": False,
        "batch_id": None
    }
    max_cap = cfg.get("max_teams_per_problem", 5)

    all_teams = teams_col.find()
    total_registered = len(all_teams)
    eligible_teams = [t for t in all_teams if not t.get("is_eliminated")]
    eligible_count = len(eligible_teams)

    # 10 problem statements for Round 1
    problems = list(problems_col.find({"round_number": 1}))
    if len(problems) < 10:
        # Auto-seed if missing
        seed_database(force=False)
        problems = list(problems_col.find({"round_number": 1}))

    problems.sort(key=lambda p: int(p.get("problem_number") or 0))

    # Fetch active allocations
    allocations = allocations_col.find()
    allocated_team_ids = set()
    problem_team_map = {p.get("problem_id", f"PS-{p.get('problem_number', 0):02d}"): [] for p in problems}

    for alloc in allocations:
        t_id = alloc.get("team_id")
        allocated_team_ids.add(t_id)
        pid = alloc.get("problem_id")
        if pid in problem_team_map:
            problem_team_map[pid].append({
                "team_id": t_id,
                "team_name": alloc.get("team_name"),
                "institution": alloc.get("institution", ""),
                "allocated_at": alloc.get("allocated_at")
            })

    # Also fallback check if team doc has assigned_problem_id directly
    for t in eligible_teams:
        t_id = t.get("team_id")
        pid = t.get("assigned_problem_id")
        if pid and t_id not in allocated_team_ids:
            allocated_team_ids.add(t_id)
            if pid in problem_team_map:
                problem_team_map[pid].append({
                    "team_id": t_id,
                    "team_name": t.get("team_name"),
                    "institution": t.get("institution", ""),
                    "allocated_at": t.get("allocated_at")
                })

    allocated_count = len(allocated_team_ids)
    unallocated_count = max(0, eligible_count - allocated_count)

    unallocated_teams = [
        {
            "team_id": t.get("team_id"),
            "team_name": t.get("team_name"),
            "institution": t.get("institution", ""),
            "leader_name": t.get("leader_name", "")
        }
        for t in eligible_teams if t.get("team_id") not in allocated_team_ids
    ]

    total_capacity = len(problems) * max_cap

    problem_distributions = []
    for p in problems:
        pid = p.get("problem_id", f"PS-{p.get('problem_number', 0):02d}")
        assigned_list = problem_team_map.get(pid, [])
        assigned_cnt = len(assigned_list)
        p_cap = p.get("max_capacity") or max_cap
        problem_distributions.append({
            "problem_id": pid,
            "problem_number": p.get("problem_number"),
            "title": p.get("title"),
            "tagline": p.get("tagline"),
            "scenario": p.get("scenario", ""),
            "max_capacity": p_cap,
            "assigned_count": assigned_cnt,
            "percentage_filled": round((assigned_cnt / p_cap) * 100, 1) if p_cap > 0 else 0,
            "is_published": bool(p.get("is_published", False)),
            "teams": assigned_list
        })

    rounds_col = db_manager.get_collection("rounds")
    r1 = rounds_col.find_one({"round_number": 1}) or {}
    is_published_status = bool(r1.get("problem_published", False))

    return {
        "total_registered_teams": total_registered,
        "eligible_teams": eligible_count,
        "allocated_teams": allocated_count,
        "unallocated_teams": unallocated_count,
        "unallocated_team_list": unallocated_teams,
        "max_teams_per_problem": max_cap,
        "total_capacity": total_capacity,
        "is_finalized": cfg.get("is_finalized", False),
        "is_automatic_enabled": cfg.get("is_automatic_enabled", True),
        "is_published": is_published_status,
        "batch_id": cfg.get("batch_id"),
        "last_allocated_at": cfg.get("last_allocated_at"),
        "problems_count": len(problems),
        "problem_distributions": problem_distributions
    }


@router.post("/allocation/allocate")
async def allocate_problem_statements(
    force: bool = Query(False),
    current_admin: dict = Depends(get_current_admin)
):
    purge_test_grid_teams()
    teams_col = db_manager.get_collection("teams")
    problems_col = db_manager.get_collection("problem_statements")
    config_col = db_manager.get_collection("allocation_config")
    allocations_col = db_manager.get_collection("allocations")
    audit_col = db_manager.get_collection("audit_logs")

    cfg = config_col.find_one({"_id": "global_allocation_config"}) or {}
    max_cap = cfg.get("max_teams_per_problem", 5)

    # 1. Idempotency Check:
    # If already finalized and force is not set, safely return existing state
    if cfg.get("is_finalized") and not force:
        existing_allocs = allocations_col.count_documents({})
        if existing_allocs > 0:
            return {
                "message": "Allocation already finalized. Existing assignments preserved idempotently.",
                "is_finalized": True,
                "batch_id": cfg.get("batch_id"),
                "allocated_count": existing_allocs
            }

    # 2. Retrieve eligible registered teams (non-eliminated)
    all_teams = teams_col.find()
    eligible_teams = [t for t in all_teams if not t.get("is_eliminated")]
    num_teams = len(eligible_teams)
    if num_teams == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No eligible registered teams found on the championship grid."
        )

    # 3. Retrieve 10 active problem statements
    problems = list(problems_col.find({"round_number": 1}))
    if len(problems) < 10:
        seed_database(force=True)
        problems = list(problems_col.find({"round_number": 1}))

    problems.sort(key=lambda p: int(p.get("problem_number") or 0))
    num_problems = len(problems)
    if num_problems == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active problem statements available for allocation."
        )

    # 4. Total Capacity Check (Flag excess teams!)
    total_capacity = num_problems * max_cap
    if num_teams > total_capacity:
        required_cap = math.ceil(num_teams / num_problems)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Grid Overflow: {num_teams} eligible teams registered, but maximum total pool capacity across {num_problems} problem statements is {total_capacity} "
                f"({max_cap} teams per problem). Please adjust the capacity per problem statement to at least {required_cap} before generating allocation."
            )
        )

    # 5. Cryptographically Secure Server-Side Balanced Randomization Algorithm
    # - Consecutive teams receive completely different problem statements (shuffled).
    # - Balanced distribution: when 50 teams participate, assign exactly 5 each.
    # - If remainder exists (e.g. 43 teams), distribute remainder fairly (e.g. 3 get 5, 7 get 4).
    rng = secrets.SystemRandom()

    base_per_prob = num_teams // num_problems
    remainder = num_teams % num_problems

    # Randomly select which problems receive the extra (+1) slot for fair remainder distribution
    extra_slot_indices = set(rng.sample(range(num_problems), remainder)) if remainder > 0 else set()

    slot_pool = []
    for idx, prob in enumerate(problems):
        slot_count = base_per_prob + (1 if idx in extra_slot_indices else 0)
        for _ in range(slot_count):
            slot_pool.append(prob)

    # slot_pool now has exactly num_teams slots!
    # Securely shuffle both slots and teams
    rng.shuffle(slot_pool)
    shuffled_teams = list(eligible_teams)
    rng.shuffle(shuffled_teams)

    now_iso = datetime.utcnow().isoformat()
    batch_id = f"BATCH-{uuid.uuid4().hex[:8].upper()}"

    # 6. Save Assignments Transactionally
    allocations_col.delete_many({})

    new_allocations = []
    for team, prob in zip(shuffled_teams, slot_pool):
        team_id = team.get("team_id")
        prob_id = prob.get("problem_id", f"PS-{prob.get('problem_number', 0):02d}")
        prob_num = prob.get("problem_number")
        prob_title = prob.get("title")

        alloc_doc = {
            "allocation_id": str(uuid.uuid4()),
            "batch_id": batch_id,
            "team_id": team_id,
            "team_name": team.get("team_name"),
            "institution": team.get("institution", ""),
            "problem_id": prob_id,
            "problem_number": prob_num,
            "problem_title": prob_title,
            "allocated_at": now_iso,
            "allocated_by": current_admin["username"]
        }
        allocations_col.insert_one(alloc_doc)
        new_allocations.append(alloc_doc)

        # Update team document
        teams_col.update_one(
            {"team_id": team_id},
            {"$set": {
                "assigned_problem_id": prob_id,
                "assigned_problem_number": prob_num,
                "assigned_problem_title": prob_title,
                "allocation_batch_id": batch_id,
                "allocated_at": now_iso
            }}
        )

    # Update config
    config_col.update_one(
        {"_id": "global_allocation_config"},
        {"$set": {
            "is_finalized": True,
            "batch_id": batch_id,
            "last_allocated_at": now_iso,
            "updated_at": now_iso
        }}
    )

    # 7. Audit Log
    audit_col.insert_one({
        "action": "AUTOMATIC_PROBLEM_ALLOCATION",
        "actor": current_admin["username"],
        "details": {
            "batch_id": batch_id,
            "teams_allocated": num_teams,
            "problems_count": num_problems,
            "max_capacity_per_problem": max_cap,
            "base_per_problem": base_per_prob,
            "remainder": remainder
        },
        "timestamp": now_iso
    })

    # Broadcast event via WebSocket
    await ws_manager.broadcast("PROBLEMS_ALLOCATED", {
        "batch_id": batch_id,
        "teams_count": num_teams,
        "timestamp": now_iso
    })

    return {
        "message": f"Successfully generated balanced random allocation for {num_teams} teams across {num_problems} problem statements!",
        "batch_id": batch_id,
        "teams_allocated": num_teams,
        "problems_count": num_problems,
        "is_finalized": True,
        "timestamp": now_iso
    }


@router.post("/allocation/reset")
async def reset_problem_allocation(
    payload: AllocationResetRequest,
    current_admin: dict = Depends(get_current_admin)
):
    if payload.confirm_text.strip().upper() != "RESET":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Confirmation text must be 'RESET' to unassign problem statements."
        )

    teams_col = db_manager.get_collection("teams")
    config_col = db_manager.get_collection("allocation_config")
    allocations_col = db_manager.get_collection("allocations")
    audit_col = db_manager.get_collection("audit_logs")

    now_iso = datetime.utcnow().isoformat()

    # Clear allocations collection
    allocations_col.delete_many({})

    # Clear assigned fields from teams
    teams_col.update_many(
        {},
        {"$unset": {
            "assigned_problem_id": "",
            "assigned_problem_number": "",
            "assigned_problem_title": "",
            "allocation_batch_id": "",
            "allocated_at": ""
        }}
    )

    # Update config
    config_col.update_one(
        {"_id": "global_allocation_config"},
        {"$set": {
            "is_finalized": False,
            "batch_id": None,
            "last_allocated_at": None,
            "updated_at": now_iso
        }}
    )

    # Log in audit trail
    audit_col.insert_one({
        "action": "PROBLEM_ALLOCATION_RESET",
        "actor": current_admin["username"],
        "details": {"reason": payload.reason or "Admin manual reset"},
        "timestamp": now_iso
    })

    # Broadcast event
    await ws_manager.broadcast("PROBLEMS_ALLOCATION_RESET", {"timestamp": now_iso})

    return {
        "message": "Problem statement allocations successfully reset. All teams returned to unallocated pool.",
        "is_finalized": False
    }


@router.get("/problem-statements")
async def get_all_problem_statements(current_admin: dict = Depends(get_current_admin)):
    problems_col = db_manager.get_collection("problem_statements")
    allocations_col = db_manager.get_collection("allocations")
    config_col = db_manager.get_collection("allocation_config")

    cfg = config_col.find_one({"_id": "global_allocation_config"}) or {}
    default_cap = cfg.get("max_teams_per_problem", 5)

    problems = list(problems_col.find({"round_number": 1}))
    if len(problems) < 10:
        seed_database(force=False)
        problems = list(problems_col.find({"round_number": 1}))

    problems.sort(key=lambda p: int(p.get("problem_number") or 0))

    # Fetch allocation counts
    all_allocs = allocations_col.find()
    count_map = {}
    for a in all_allocs:
        pid = a.get("problem_id")
        count_map[pid] = count_map.get(pid, 0) + 1

    for p in problems:
        pid = p.get("problem_id", f"PS-{p.get('problem_number', 0):02d}")
        p["assigned_teams_count"] = count_map.get(pid, 0)
        p["max_capacity"] = p.get("max_capacity") or default_cap

    return problems


@router.post("/problem-statements")
async def create_or_bulk_upload_problems(
    problems_data: Any,
    current_admin: dict = Depends(get_current_admin)
):
    problems_col = db_manager.get_collection("problem_statements")
    audit_col = db_manager.get_collection("audit_logs")
    now_iso = datetime.utcnow().isoformat()

    items = problems_data if isinstance(problems_data, list) else [problems_data]
    created = []

    for item in items:
        p_num = item.get("problem_number", len(created) + 1)
        pid = item.get("problem_id", f"PS-{p_num:02d}")
        doc = {
            "problem_id": pid,
            "problem_number": p_num,
            "round_number": item.get("round_number", 1),
            "title": item.get("title", f"Problem Statement {p_num}"),
            "tagline": item.get("tagline", ""),
            "scenario": item.get("scenario", ""),
            "description": item.get("description", ""),
            "functional_requirements": item.get("functional_requirements", []),
            "technical_constraints": item.get("technical_constraints", []),
            "deliverables": item.get("deliverables", []),
            "evaluation_criteria": item.get("evaluation_criteria", []),
            "max_capacity": item.get("max_capacity", 5),
            "is_published": item.get("is_published", True),
            "created_at": now_iso,
            "updated_at": now_iso
        }
        existing = problems_col.find_one({"problem_id": pid})
        if existing:
            problems_col.update_one({"problem_id": pid}, {"$set": doc})
        else:
            problems_col.insert_one(doc)
        created.append(doc)

    audit_col.insert_one({
        "action": "PROBLEM_STATEMENTS_SAVED",
        "actor": current_admin["username"],
        "details": {"count": len(created)},
        "timestamp": now_iso
    })

    return {"message": f"Successfully saved {len(created)} problem statements.", "problems": created}


@router.put("/problem-statements/{problem_id}")
async def update_problem_statement(
    problem_id: str,
    payload: ProblemStatementUpdate,
    current_admin: dict = Depends(get_current_admin)
):
    problems_col = db_manager.get_collection("problem_statements")
    audit_col = db_manager.get_collection("audit_logs")
    now_iso = datetime.utcnow().isoformat()

    existing = problems_col.find_one({"problem_id": problem_id}) or problems_col.find_one({"_id": problem_id})
    if not existing:
        raise HTTPException(404, "Problem statement not found")

    # Strictly edit previous existing fields in-place in MongoDB.
    # Do NOT create separate columns or extra custom fields.
    allowed_fields = {
        "title", "tagline", "scenario", "description",
        "functional_requirements", "technical_constraints",
        "deliverables", "evaluation_criteria", "max_capacity", "is_published"
    }

    update_fields = {}
    for k, v in payload.dict(exclude_unset=True).items():
        if v is not None and k in allowed_fields:
            update_fields[k] = v

    update_fields["updated_at"] = now_iso
    problems_col.update_one({"_id": existing["_id"]}, {"$set": update_fields})

    return problems_col.find_one({"_id": existing["_id"]})



@router.post("/teams/generate-test-grid")
async def generate_test_grid(
    count: int = Query(50, ge=1, le=100),
    current_admin: dict = Depends(get_current_admin)
):
    purge_test_grid_teams()
    teams_col = db_manager.get_collection("teams")
    return {
        "message": "Test grid generation is disabled. Only genuine registered teams appear on the championship grid.",
        "created_count": 0,
        "total_teams": teams_col.count_documents({})
    }


@router.post("/reset-event")
async def reset_entire_event(
    payload: ResetEventRequest,
    current_admin: dict = Depends(get_current_admin)
):
    if payload.confirm_text.strip().upper() != "RESET":
        raise HTTPException(
            status_code=400,
            detail="Confirmation text must be 'RESET' to reset the entire event."
        )

    users_col = db_manager.get_collection("users")
    teams_col = db_manager.get_collection("teams")
    submissions_col = db_manager.get_collection("submissions")
    evaluations_col = db_manager.get_collection("evaluations")
    rounds_col = db_manager.get_collection("rounds")
    settings_col = db_manager.get_collection("system_settings")
    audit_col = db_manager.get_collection("audit_logs")
    now_iso = datetime.utcnow().isoformat()

    # 1. Reset active user sessions (DO NOT DELETE USERS)
    all_users = users_col.find({})
    for u in all_users:
        users_col.update_one(
            {"_id": u["_id"]},
            {"$set": {"active_session": False, "active_session_token": None}}
        )

    # 2. Reset team scores and status (DO NOT DELETE TEAMS) & clear problem allocations
    all_teams = teams_col.find({})
    for t in all_teams:
        teams_col.update_one(
            {"_id": t["_id"]},
            {
                "$set": {
                    "status": "ACTIVE",
                    "is_qualified_r3": False,
                    "is_eliminated": False,
                    "total_score": 0.0,
                    "scores_by_round": {},
                    "director_feedback": ""
                },
                "$unset": {
                    "assigned_problem_id": "",
                    "assigned_problem_number": "",
                    "assigned_problem_title": "",
                    "allocation_batch_id": "",
                    "allocated_at": ""
                }
            }
        )

    # 3. Clear problem allocations & unpublish all problem statements
    allocations_col = db_manager.get_collection("allocations")
    if db_manager.is_atlas:
        allocations_col.delete_many({})
    else:
        allocations_col._write_all([])

    problems_col = db_manager.get_collection("problem_statements")
    problems_col.update_many({}, {"$set": {"is_published": False, "updated_at": now_iso}})

    config_col = db_manager.get_collection("allocation_config")
    config_col.update_one(
        {"_id": "global_allocation_config"},
        {"$set": {
            "is_finalized": False,
            "batch_id": None,
            "last_allocated_at": None,
            "updated_at": now_iso
        }},
        upsert=True
    )

    # 4. Clear submissions
    if db_manager.is_atlas:
        submissions_col.delete_many({})
    else:
        submissions_col._write_all([])

    # 5. Clear evaluations
    if db_manager.is_atlas:
        evaluations_col.delete_many({})
    else:
        evaluations_col._write_all([])

    # 6. Reset all rounds to fresh initial locked state with problem_published=False
    rounds_reset_config = [
        {
            "round_number": 1,
            "title": "Round 1 — Architecture Design",
            "subtitle": "Participants must design a robust, scalable, secure, and cost-efficient cloud architecture capable of handling high-velocity telemetry streams in real time. Teams will develop an architecture blueprint incorporating multi-region cloud infrastructure, event-stream processing, VPC security boundaries, fault tolerance, disaster recovery, and cost optimization under strict budget constraints.",
            "icon": "Cpu",
            "status": "LOCKED",
            "start_time": None,
            "deadline": None,
            "is_active": False,
            "problem_published": False,
            "duration_minutes": 45,
            "submissions_open": False,
            "results_announced": False,
            "results_announcement_time": None,
            "results_timer_active": False,
            "updated_at": now_iso
        },
        {
            "round_number": 2,
            "title": "Round 2 — Build & Deploy",
            "subtitle": "Teams must transform their proposed architecture into a functional cloud-based application or prototype. Participants will configure cloud services, deploy application components, integrate APIs and databases, and demonstrate the working solution. The application will be evaluated on functionality, deployment quality, security, scalability, resource utilization, and adherence to the given problem statement.",
            "icon": "Rocket",
            "status": "LOCKED",
            "start_time": None,
            "deadline": None,
            "is_active": False,
            "problem_published": False,
            "duration_minutes": 210,
            "submissions_open": False,
            "updated_at": now_iso
        },
        {
            "round_number": 3,
            "title": "Round 3 — Cloud Crisis Challenge",
            "subtitle": "Qualified teams will face unexpected real-world cloud infrastructure challenges introduced by the organizers. Teams must diagnose the issue, implement an appropriate solution, and demonstrate how their application maintains availability, performance, and reliability under pressure. Challenges will use controlled simulations or safely configured test environments.",
            "icon": "AlertTriangle",
            "status": "LOCKED",
            "start_time": None,
            "deadline": None,
            "is_active": False,
            "problem_published": False,
            "results_announced": False,
            "results_announcement_time": None,
            "results_timer_active": False,
            "results_held": True,
            "selection_revealed": False,
            "updated_at": now_iso
        }
    ]

    for r_conf in rounds_reset_config:
        rounds_col.update_one(
            {"round_number": r_conf["round_number"]},
            {"$set": r_conf},
            upsert=True
        )

    # 6. Reset Winner Announcement & Leaderboard config
    settings_col.update_one(
        {"key": "winner_announcement"},
        {"$set": {
            "key": "winner_announcement",
            "is_announced": False,
            "winners": [],
            "podium": [],
            "announcement_time": None,
            "title": "Championship Winners Announcement",
            "timer_active": False,
            "timer_duration_seconds": 0,
            "timer_end_time": None
        }},
        upsert=True
    )

    settings_col.update_one(
        {"key": "leaderboard_config"},
        {"$set": {
            "key": "leaderboard_config",
            "visibility_mode": "PUBLIC",
            "freeze_message": ""
        }},
        upsert=True
    )

    # 7. Audit log
    audit_col.insert_one({
        "action": "EVENT_RESET",
        "actor": current_admin["username"],
        "details": {"reason": "Admin full event reset"},
        "timestamp": now_iso
    })

    # Broadcast websocket events
    await ws_manager.broadcast("EVENT_RESET", {"timestamp": now_iso})
    await ws_manager.broadcast("PROBLEMS_ALLOCATION_RESET", {"timestamp": now_iso})
    await ws_manager.broadcast("PROBLEM_UNPUBLISHED", {"round_number": 1, "timestamp": now_iso})
    for r_conf in rounds_reset_config:
        await ws_manager.broadcast("ROUND_STATUS_CHANGED", r_conf)
    await ws_manager.broadcast("WINNER_ANNOUNCEMENT_UPDATED", {
        "key": "winner_announcement",
        "is_announced": False,
        "winners": [],
        "podium": [],
        "timer_active": False
    })

    return {
        "message": "Entire event successfully reset to the beginning. All users and teams are preserved.",
        "timestamp": now_iso
    }


