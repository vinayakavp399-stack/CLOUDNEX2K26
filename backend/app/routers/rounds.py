from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from app.auth import get_current_user
from app.database import db_manager
from app.models import RoundState, TeamStatus, UserRole
from app.websocket_manager import ws_manager

router = APIRouter(prefix="/rounds", tags=["Rounds"])


@router.get("")
async def get_all_rounds(current_user: Optional[dict] = Depends(get_current_user)):
    rounds_col = db_manager.get_collection("rounds")
    problems_col = db_manager.get_collection("problem_statements")
    teams_col = db_manager.get_collection("teams")

    is_admin = current_user and current_user.get("role") == UserRole.ADMIN
    team = None
    if current_user and current_user.get("role") == UserRole.PARTICIPANT and current_user.get("team_id"):
        team = teams_col.find_one({"team_id": current_user["team_id"]})

    raw_rounds = list(rounds_col.find())
    all_problems = list(problems_col.find())
    all_rounds = []
    for num in [1, 2, 3]:
        matching = [r for r in raw_rounds if int(r.get("round_number", 0)) == num]
        if matching:
            all_rounds.append(matching[0])

    response_rounds = []
    now_dt = datetime.utcnow()
    for r in all_rounds:
        r_num = r.get("round_number")
        # Auto-close if round is live and deadline has expired
        if r.get("status") == "LIVE" and r.get("deadline"):
            try:
                deadline_dt = datetime.fromisoformat(r["deadline"].replace("Z", "+00:00")).replace(tzinfo=None)
                if now_dt >= deadline_dt:
                    rounds_col.update_one(
                        {"round_number": r_num},
                        {"$set": {"status": "CLOSED", "is_active": False, "updated_at": now_dt.isoformat()}}
                    )
                    r["status"] = "CLOSED"
                    r["is_active"] = False
                    await ws_manager.broadcast("ROUND_STATUS_CHANGED", {
                        "round_number": r_num,
                        "status": "CLOSED",
                        "is_active": False,
                        "submissions_open": False
                    })

                    # Auto-open Round 2 when Round 1 timer expires
                    if r_num == 1:
                        r2_doc = rounds_col.find_one({"round_number": 2})
                        if r2_doc and r2_doc.get("status") not in ["LIVE", "CLOSED", "COMPLETED"]:
                            r2_deadline = now_dt + timedelta(minutes=210)
                            rounds_col.update_one(
                                {"round_number": 2},
                                {"$set": {
                                    "status": "LIVE",
                                    "is_active": True,
                                    "start_time": now_dt.isoformat(),
                                    "deadline": r2_deadline.isoformat(),
                                    "duration_minutes": 210,
                                    "submissions_open": False,
                                    "problem_published": True,
                                    "updated_at": now_dt.isoformat()
                                }}
                            )
                            problems_col.update_many({"round_number": 2}, {"$set": {"is_published": True, "updated_at": now_dt.isoformat()}})
                            await ws_manager.broadcast("ROUND_STATUS_CHANGED", {
                                "round_number": 2,
                                "status": "LIVE",
                                "is_active": True,
                                "start_time": now_dt.isoformat(),
                                "deadline": r2_deadline.isoformat(),
                                "duration_minutes": 210,
                                "submissions_open": False,
                                "problem_published": True
                            })
            except Exception:
                pass

        r_dict = {
            "round_number": r_num,
            "title": r.get("title"),
            "subtitle": r.get("subtitle"),
            "icon": r.get("icon"),
            "status": r.get("status"),
            "start_time": r.get("start_time"),
            "deadline": r.get("deadline"),
            "is_active": r.get("is_active", False),
            "problem_published": r.get("problem_published", False),
            "submissions_open": r.get("submissions_open", False),
            "results_announcement_time": r.get("results_announcement_time"),
            "results_timer_active": r.get("results_timer_active", False),
            "results_announced": r.get("results_announced", False),
            "selection_revealed": r.get("selection_revealed", False),
            "results_held": r.get("results_held", False),
            "updated_at": r.get("updated_at")
        }

        # Check qualification & elimination status for Round 3
        if r_num == 3:
            now_dt = datetime.utcnow()
            announcement_time = r.get("results_announcement_time")
            is_timer_expired = False
            if announcement_time:
                try:
                    ann_dt = datetime.fromisoformat(announcement_time.replace("Z", "+00:00")).replace(tzinfo=None)
                    is_timer_expired = ann_dt <= now_dt
                except Exception:
                    pass
            is_held = bool(r.get("results_held", False))
            is_selection_revealed = bool(
                not is_held and (
                    r.get("selection_revealed") or
                    r.get("results_announced") or
                    (r.get("results_timer_active") and is_timer_expired)
                )
            )

            # Auto-persist to database if countdown timer has elapsed
            if r.get("results_timer_active") and is_timer_expired and not is_held:
                try:
                    rounds_col.update_one(
                        {"round_number": 3},
                        {"$set": {
                            "selection_revealed": True,
                            "results_announced": True,
                            "results_timer_active": False,
                            "updated_at": now_dt.isoformat()
                        }}
                    )
                    r["selection_revealed"] = True
                    r["results_announced"] = True
                    r["results_timer_active"] = False
                    await ws_manager.broadcast("ROUND_3_RESULTS_TIMER", {
                        "round_number": 3,
                        "results_announcement_time": None,
                        "results_timer_active": False,
                        "results_announced": True,
                        "selection_revealed": True,
                        "results_held": False,
                        "timestamp": now_dt.isoformat()
                    })
                    await ws_manager.broadcast("ROUND_STATUS_CHANGED", {
                        "round_number": 3,
                        "selection_revealed": True,
                        "results_announced": True,
                        "results_timer_active": False
                    })
                except Exception:
                    pass

            r_dict["selection_revealed"] = is_selection_revealed
            r_dict["results_announced"] = bool(r.get("results_announced") or is_selection_revealed)
            if is_timer_expired:
                r_dict["results_timer_active"] = False

            if is_admin:
                if team and team.get("is_qualified_r3"):
                    r_dict["user_access"] = "QUALIFIED"
                elif team and team.get("is_eliminated"):
                    r_dict["user_access"] = "ELIMINATED"
                elif team:
                    r_dict["user_access"] = "NOT_QUALIFIED"
                else:
                    r_dict["user_access"] = "ADMIN"
            elif is_selection_revealed:
                if team and team.get("is_qualified_r3"):
                    r_dict["user_access"] = "QUALIFIED"
                elif team and team.get("is_eliminated"):
                    r_dict["user_access"] = "ELIMINATED"
                else:
                    r_dict["user_access"] = "NOT_QUALIFIED"
            else:
                # When selection is concealed or held, participants do NOT see qualified or eliminated status
                r_dict["user_access"] = "PENDING_ANNOUNCEMENT"
                r_dict["selection_status"] = "SEALED"
                r_dict["lock_reason"] = "Round 3 selections are sealed and pending steward announcement."

        # Check problem statement visibility
        if r_num in [1, 2]:
            assigned_pid = team.get("assigned_problem_id") if team else None
            assigned_pnum = team.get("assigned_problem_number") if team else None
            problem_doc = None
            if assigned_pid:
                problem_doc = next((p for p in all_problems if p.get("problem_id") == assigned_pid), None)
            elif assigned_pnum:
                problem_doc = next((p for p in all_problems if p.get("problem_number") == assigned_pnum), None)
            
            # Fallback to the official problem statement for this round
            if not problem_doc:
                if r_num == 2:
                    problem_doc = (
                        next((p for p in all_problems if p.get("round_number") == 2 and p.get("is_published")), None)
                        or next((p for p in all_problems if p.get("round_number") == 2), None)
                    )
                else:
                    problem_doc = (
                        next((p for p in all_problems if p.get("round_number") == 1 and p.get("is_published")), None)
                        or next((p for p in all_problems if p.get("round_number") == 1 and p.get("problem_number") == 1), None)
                        or next((p for p in all_problems if p.get("round_number") == 1), None)
                    )
        else:
            # Round 3 does not have a problem statement section (only selection status is shown)
            problem_doc = None
        
        if is_admin:
            # Admin sees problem statement for review
            r_dict["problem_statement"] = problem_doc
        else:
            # Participant visibility enforcement - all registered teams see released problem statement
            can_see_problem = False
            
            if r_num in [1, 2]:
                r1_doc = next((rd for rd in all_rounds if int(rd.get("round_number", 0)) == 1), {})
                is_released = bool(
                    r1_doc.get("problem_published", False) or
                    r1_doc.get("status") == RoundState.LIVE or
                    r.get("problem_published", False) or
                    r.get("status") == RoundState.LIVE or
                    (problem_doc and problem_doc.get("is_published", False))
                )

                if not is_released:
                    can_see_problem = False
                    r_dict["lock_reason"] = "Problem statement has not yet been released."
                    r_dict["allocation_status"] = "NOT_RELEASED"
                else:
                    if problem_doc:
                        can_see_problem = True
                        r_dict["allocation_status"] = "RELEASED"
                    else:
                        can_see_problem = False
                        r_dict["lock_reason"] = "Problem statement has not yet been released."
                        r_dict["allocation_status"] = "NOT_RELEASED"
            else:
                # Round 3 (Final Lap): No PS section, only selection status
                can_see_problem = False
                r_dict["problem_statement"] = None
                if team:
                    if team.get("is_eliminated"):
                        r_dict["selection_status"] = "ELIMINATED"
                        r_dict["lock_reason"] = "Your team was not selected for Round 3."
                    elif team.get("is_qualified_r3"):
                        r_dict["selection_status"] = "QUALIFIED"
                        r_dict["lock_reason"] = "Your team is selected for Round 3 (Final Lap)!"
                    else:
                        r_dict["selection_status"] = "PENDING"
                        r_dict["lock_reason"] = "Round 3 qualifiers will be announced after Round 2 evaluations."
                else:
                    r_dict["selection_status"] = "PENDING"
                    r_dict["lock_reason"] = "Round 3 qualifiers will be announced after Round 2 evaluations."

            if can_see_problem and problem_doc:
                r_dict["problem_statement"] = {
                    "problem_id": problem_doc.get("problem_id", f"PS-{r_num}"),
                    "problem_number": problem_doc.get("problem_number", r_num),
                    "title": problem_doc.get("title"),
                    "tagline": problem_doc.get("tagline"),
                    "scenario": problem_doc.get("scenario"),
                    "description": problem_doc.get("description"),
                    "functional_requirements": problem_doc.get("functional_requirements", []),
                    "technical_constraints": problem_doc.get("technical_constraints", []),
                    "deliverables": problem_doc.get("deliverables", []),
                    "evaluation_criteria": problem_doc.get("evaluation_criteria", []),
                    "attachments": problem_doc.get("attachments", [])
                }
            else:
                r_dict["problem_statement"] = None

        response_rounds.append(r_dict)

    return response_rounds


@router.get("/{round_number}")
async def get_round_detail(round_number: int, current_user: Optional[dict] = Depends(get_current_user)):
    rounds_col = db_manager.get_collection("rounds")
    problems_col = db_manager.get_collection("problem_statements")
    teams_col = db_manager.get_collection("teams")

    r = rounds_col.find_one({"round_number": round_number})
    if not r:
        raise HTTPException(status_code=404, detail="Round not found")

    is_admin = current_user and current_user.get("role") == UserRole.ADMIN
    team = None
    if current_user and current_user.get("role") == UserRole.PARTICIPANT and current_user.get("team_id"):
        team = teams_col.find_one({"team_id": current_user["team_id"]})

    now_dt = datetime.utcnow()
    if r.get("status") == "LIVE" and r.get("deadline"):
        try:
            deadline_dt = datetime.fromisoformat(r["deadline"].replace("Z", "+00:00")).replace(tzinfo=None)
            if now_dt >= deadline_dt:
                rounds_col.update_one(
                    {"round_number": round_number},
                    {"$set": {"status": "CLOSED", "is_active": False, "updated_at": now_dt.isoformat()}}
                )
                r["status"] = "CLOSED"
                r["is_active"] = False

                if round_number == 1:
                    r2_doc = rounds_col.find_one({"round_number": 2})
                    if r2_doc and r2_doc.get("status") not in ["LIVE", "CLOSED", "COMPLETED"]:
                        r2_deadline = now_dt + timedelta(minutes=210)
                        rounds_col.update_one(
                            {"round_number": 2},
                            {"$set": {
                                "status": "LIVE",
                                "is_active": True,
                                "start_time": now_dt.isoformat(),
                                "deadline": r2_deadline.isoformat(),
                                "duration_minutes": 210,
                                "submissions_open": False,
                                "problem_published": True,
                                "updated_at": now_dt.isoformat()
                            }}
                        )
                        problems_col.update_many({"round_number": 2}, {"$set": {"is_published": True, "updated_at": now_dt.isoformat()}})
        except Exception:
            pass

    r_dict = {
        "round_number": round_number,
        "title": r.get("title"),
        "subtitle": r.get("subtitle"),
        "icon": r.get("icon"),
        "status": r.get("status"),
        "start_time": r.get("start_time"),
        "deadline": r.get("deadline"),
        "is_active": r.get("is_active", False),
        "problem_published": r.get("problem_published", False),
        "submissions_open": r.get("submissions_open", False),
        "results_announcement_time": r.get("results_announcement_time"),
        "results_timer_active": r.get("results_timer_active", False),
        "results_announced": r.get("results_announced", False),
        "selection_revealed": r.get("selection_revealed", False),
        "results_held": r.get("results_held", False)
    }

    if round_number in [1, 2]:
        assigned_pid = team.get("assigned_problem_id") if team else None
        assigned_pnum = team.get("assigned_problem_number") if team else None
        if assigned_pid:
            problem_doc = problems_col.find_one({"problem_id": assigned_pid})
        elif assigned_pnum:
            problem_doc = problems_col.find_one({"problem_number": assigned_pnum})
        else:
            problem_doc = None

        # Fallback to the official problem statement for this round
        if not problem_doc:
            if round_number == 2:
                problem_doc = problems_col.find_one({"round_number": 2, "is_published": True}) or problems_col.find_one({"round_number": 2})
            else:
                problem_doc = problems_col.find_one({"round_number": 1, "is_published": True}) or problems_col.find_one({"round_number": 1, "problem_number": 1}) or problems_col.find_one({"round_number": 1})
    else:
        # Round 3 does not have a problem statement section
        problem_doc = None

    if is_admin:
        r_dict["problem_statement"] = problem_doc
    else:
        can_see = False
        if round_number in [1, 2]:
            r1_doc = rounds_col.find_one({"round_number": 1}) or {}
            is_released = bool(
                r1_doc.get("problem_published", False) or
                r1_doc.get("status") == RoundState.LIVE or
                r.get("problem_published", False) or
                r.get("status") == RoundState.LIVE or
                (problem_doc and problem_doc.get("is_published", False))
            )

            if not is_released:
                can_see = False
                r_dict["lock_reason"] = "Problem statement has not yet been released."
                r_dict["allocation_status"] = "NOT_RELEASED"
            else:
                if problem_doc:
                    can_see = True
                    r_dict["allocation_status"] = "RELEASED"
                else:
                    can_see = False
                    r_dict["lock_reason"] = "Problem statement has not yet been released."
                    r_dict["allocation_status"] = "NOT_RELEASED"
        else:
            can_see = False
            r_dict["problem_statement"] = None
            now_dt = datetime.utcnow()
            announcement_time = r.get("results_announcement_time")
            is_timer_expired = False
            if announcement_time:
                try:
                    ann_dt = datetime.fromisoformat(announcement_time.replace("Z", "+00:00")).replace(tzinfo=None)
                    is_timer_expired = ann_dt <= now_dt
                except Exception:
                    pass
            is_held = bool(r.get("results_held", False))
            is_selection_revealed = bool(
                not is_held and (
                    r.get("selection_revealed") or
                    r.get("results_announced") or
                    (r.get("results_timer_active") and is_timer_expired)
                )
            )

            if r.get("results_timer_active") and is_timer_expired and not is_held:
                try:
                    rounds_col.update_one(
                        {"round_number": 3},
                        {"$set": {
                            "selection_revealed": True,
                            "results_announced": True,
                            "results_timer_active": False,
                            "updated_at": now_dt.isoformat()
                        }}
                    )
                    r["selection_revealed"] = True
                    r["results_announced"] = True
                    r["results_timer_active"] = False
                    await ws_manager.broadcast("ROUND_3_RESULTS_TIMER", {
                        "round_number": 3,
                        "results_announcement_time": None,
                        "results_timer_active": False,
                        "results_announced": True,
                        "selection_revealed": True,
                        "results_held": False,
                        "timestamp": now_dt.isoformat()
                    })
                    await ws_manager.broadcast("ROUND_STATUS_CHANGED", {
                        "round_number": 3,
                        "selection_revealed": True,
                        "results_announced": True,
                        "results_timer_active": False
                    })
                except Exception:
                    pass

            r_dict["selection_revealed"] = is_selection_revealed
            r_dict["results_announced"] = bool(r.get("results_announced") or is_selection_revealed)
            if is_timer_expired:
                r_dict["results_timer_active"] = False

            if is_admin:
                if team and team.get("is_qualified_r3"):
                    r_dict["selection_status"] = "QUALIFIED"
                    r_dict["lock_reason"] = "Your team is selected for Round 3 (Final Lap)!"
                elif team and team.get("is_eliminated"):
                    r_dict["selection_status"] = "ELIMINATED"
                    r_dict["lock_reason"] = "Your team was not selected for Round 3."
                else:
                    r_dict["selection_status"] = "PENDING"
                    r_dict["lock_reason"] = "Round 3 qualifiers will be announced after Round 2 evaluations."
            elif is_selection_revealed:
                if team and team.get("is_qualified_r3"):
                    r_dict["selection_status"] = "QUALIFIED"
                    r_dict["lock_reason"] = "Your team is selected for Round 3 (Final Lap)!"
                elif team and team.get("is_eliminated"):
                    r_dict["selection_status"] = "ELIMINATED"
                    r_dict["lock_reason"] = "Your team was not selected for Round 3."
                else:
                    r_dict["selection_status"] = "NOT_QUALIFIED"
                    r_dict["lock_reason"] = "Your team was not selected for Round 3."
            else:
                r_dict["selection_status"] = "PENDING_ANNOUNCEMENT"
                r_dict["lock_reason"] = "Round 3 selection announcement is currently sealed / held by race control."

        if can_see and problem_doc:
            r_dict["problem_statement"] = {
                "problem_id": problem_doc.get("problem_id", f"PS-{round_number}"),
                "problem_number": problem_doc.get("problem_number", round_number),
                "title": problem_doc.get("title"),
                "tagline": problem_doc.get("tagline"),
                "scenario": problem_doc.get("scenario"),
                "description": problem_doc.get("description"),
                "functional_requirements": problem_doc.get("functional_requirements", []),
                "technical_constraints": problem_doc.get("technical_constraints", []),
                "deliverables": problem_doc.get("deliverables", []),
                "evaluation_criteria": problem_doc.get("evaluation_criteria", []),
                "attachments": problem_doc.get("attachments", [])
            }
        else:
            r_dict["problem_statement"] = None

    return r_dict
