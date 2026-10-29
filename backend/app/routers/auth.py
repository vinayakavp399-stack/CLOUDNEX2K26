import asyncio
from datetime import datetime, timezone
import logging
import re
from typing import Optional
import uuid
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from app.auth import (
    create_access_token,
    get_current_user,
    get_password_hash,
    invalidate_user_cache,
    set_cached_user,
    verify_password
)
from app.database import db_manager
from app.websocket_manager import ws_manager
from app.models import (
    LoginRequest,
    RegisterParticipantRequest,
    TeamStatus,
    Token,
    UserRole
)

logger = logging.getLogger("cloudnex.auth")
router = APIRouter(prefix="/auth", tags=["Authentication"])

# In-memory cached Round 3 settings to eliminate repeated remote database roundtrips
_r3_cache: Optional[dict] = None
_r3_cache_ts: float = 0
_R3_CACHE_TTL = 30  # seconds

def _get_cached_round_3() -> Optional[dict]:
    global _r3_cache, _r3_cache_ts
    now = datetime.utcnow().timestamp()
    if _r3_cache is not None and (now - _r3_cache_ts) < _R3_CACHE_TTL:
        return _r3_cache
    try:
        rounds_col = db_manager.get_collection("rounds")
        r3 = rounds_col.find_one({"round_number": 3})
        _r3_cache = dict(r3) if r3 else {}
        _r3_cache_ts = now
        return _r3_cache
    except Exception:
        return _r3_cache or {}

def _apply_r3_rules_to_team(team_dict: dict):
    r3 = _get_cached_round_3()
    is_held = bool(r3.get("results_held", False)) if r3 else False
    now_dt = datetime.utcnow()
    announcement_time = r3.get("results_announcement_time") if r3 else None
    is_timer_expired = False
    if announcement_time:
        try:
            ann_dt = datetime.fromisoformat(announcement_time.replace("Z", "+00:00")).replace(tzinfo=None)
            is_timer_expired = ann_dt <= now_dt
        except Exception:
            pass
    is_revealed = bool(
        not is_held and (
            r3.get("selection_revealed") or
            r3.get("results_announced") or
            (r3.get("results_timer_active") and is_timer_expired)
        )
    ) if r3 else False
    if not is_revealed:
        team_dict["is_qualified_r3"] = False
        team_dict["is_eliminated"] = False
    if team_dict.get("director_feedback"):
        fb = team_dict["director_feedback"]
        fb = re.sub(r'\s*based on Round 1 & 2 score\s*\([^)]*\)', ' based on Round 1 & 2 performance.', fb, flags=re.IGNORECASE)
        fb = re.sub(r'\s*based on Round 1 & 2 marks\s*\([^)]*\)', ' based on Round 1 & 2 performance.', fb, flags=re.IGNORECASE)
        fb = re.sub(r'\s*\(\d+(\.\d+)?\s*(pts|points)?\)', '', fb, flags=re.IGNORECASE)
        fb = re.sub(r'\s+pts\b', '', fb, flags=re.IGNORECASE)
        fb = re.sub(r'\s+points\b', '', fb, flags=re.IGNORECASE)
        team_dict["director_feedback"] = fb.strip()
    return team_dict


@router.post("/login", response_model=Token)
async def login(credentials: LoginRequest, background_tasks: BackgroundTasks):
    raw_id = credentials.username.strip()
    id_lower = raw_id.lower()
    id_upper = raw_id.upper()
    users_col = db_manager.get_collection("users")
    
    # 1. Ultra-fast direct single-trip lookup covering username, team_id, and email (all indexed)
    query_conditions = [
        {"username": id_lower},
        {"team_id": id_upper},
        {"team_id": id_lower},
        {"email": id_lower},
        {"username": raw_id},
        {"team_id": raw_id},
        {"email": raw_id}
    ]
    if id_lower == "admin":
        query_conditions.append({"role": UserRole.ADMIN})

    user = await asyncio.to_thread(users_col.find_one, {"$or": query_conditions})

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials. Check your username, email, team ID, or password."
        )

    # 2. Verify password in separate worker thread to prevent event loop freeze
    t3_pre = datetime.utcnow().timestamp()
    is_valid = await asyncio.to_thread(verify_password, credentials.password, user.get("hashed_password", ""))
    t3 = datetime.utcnow().timestamp()
    logger.info(f"[PERF] verify_password took: {t3 - t3_pre:.3f}s (valid: {is_valid})")
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials. Check your username, email, team ID, or password."
        )

    # 2.5 Enforce strict portal role separation:
    if credentials.required_role:
        if credentials.required_role == UserRole.ADMIN and user.get("role") != UserRole.ADMIN:
            logger.warning(f"Role mismatch: Participant '{user.get('username')}' tried to log in through Admin portal")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Participant credentials cannot be used for Race Director (Admin) login. Please use the Participant Login portal."
            )
        if credentials.required_role == UserRole.PARTICIPANT and user.get("role") != UserRole.PARTICIPANT:
            logger.warning(f"Role mismatch: Admin '{user.get('username')}' tried to log in through Participant portal")
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Race Director (Admin) credentials cannot be used for Participant login. Please use the Organizer Login portal."
            )

    # 3. Enforce single device login: Prevent multiple logins from the same participant team
    if user.get("role") == UserRole.PARTICIPANT and user.get("team_id"):
        team_id = user["team_id"]
        has_active_session = bool(user.get("active_session")) or bool(user.get("active_session_token"))
        has_live_stream = ws_manager.is_team_online(team_id) or bool(team_id in ws_manager.team_connections and len(ws_manager.team_connections[team_id]) > 0)

        # Block if active on another device and user has not confirmed force takeover
        if (has_active_session or has_live_stream) and not getattr(credentials, "force", False):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Team '{team_id}' is already logged in on another device. Participants can only access from one device at a time."
            )

        # If another device was active and force=True, kick the old device out
        if has_active_session or has_live_stream:
            logger.info(f"Terminating old session for team '{team_id}' to activate new device")
            try:
                await ws_manager.send_team_message(
                    team_id,
                    "FORCE_LOGOUT",
                    {"message": "Your session has been terminated because this account was logged into on another device."}
                )
                await ws_manager.close_team_connections(team_id, reason="LOGGED_IN_ON_ANOTHER_DEVICE")
            except Exception as e:
                logger.warning(f"Failed to broadcast FORCE_LOGOUT: {e}")

    # 4. Generate token and session id
    session_id = str(uuid.uuid4())
    now_iso = datetime.utcnow().isoformat()
    user_id = user["_id"]

    # 5. Populate in-memory user cache immediately for 0ms lag
    clean_user = {
        "username": user["username"],
        "email": user.get("email"),
        "role": user["role"],
        "team_id": user.get("team_id"),
        "team_name": user.get("team_name"),
        "active_session": True,
        "active_session_token": session_id
    }
    set_cached_user(user["username"], clean_user)

    # Run session update in DB concurrently with team profile query
    db_update_task = asyncio.to_thread(
        users_col.update_one,
        {"_id": user_id},
        {
            "$set": {
                "active_session": True,
                "active_session_token": session_id,
                "last_active": now_iso
            }
        }
    )

    user_info = dict(clean_user)
    team_data = None

    if user.get("role") == UserRole.PARTICIPANT and user.get("team_id"):
        teams_col = db_manager.get_collection("teams")
        team_fetch_task = asyncio.to_thread(teams_col.find_one, {"team_id": user["team_id"]})
        # Execute both operations concurrently!
        _, team = await asyncio.gather(db_update_task, team_fetch_task)
        if team:
            team_dict = _apply_r3_rules_to_team(dict(team))
            user_info["team"] = team_dict
            team_data = team_dict
    else:
        await db_update_task

    # 7. Generate JWT access token
    token_data = {
        "sub": user["username"],
        "role": user["role"],
        "team_id": user.get("team_id"),
        "team_name": user.get("team_name"),
        "session_id": session_id
    }
    access_token = create_access_token(data=token_data)

    return Token(
        access_token=access_token,
        token_type="bearer",
        role=user["role"],
        username=user["username"],
        team_id=user.get("team_id"),
        team_name=user.get("team_name"),
        user=user_info,
        team=team_data
    )


@router.post("/logout")
async def logout(current_user: dict = Depends(get_current_user)):
    """Ends the active session and allows login on another device for participants."""
    username = current_user.get("username")
    team_id = current_user.get("team_id")
    users_col = db_manager.get_collection("users")

    # Only participants enforce single-device active session clearing
    if current_user.get("role") == UserRole.PARTICIPANT:
        query = {"team_id": team_id} if team_id else {"username": username}
        await asyncio.to_thread(
            users_col.update_one,
            query,
            {"$set": {"active_session": False, "active_session_token": None}}
        )
        if username:
            invalidate_user_cache(username)

    return {"message": "Logged out successfully"}


@router.post("/token", response_model=Token)
async def login_for_access_token(background_tasks: BackgroundTasks, form_data: OAuth2PasswordRequestForm = Depends()):
    return await login(LoginRequest(username=form_data.username, password=form_data.password), background_tasks=background_tasks)


@router.post("/register-participant")
async def register_participant(data: RegisterParticipantRequest):
    users_col = db_manager.get_collection("users")
    teams_col = db_manager.get_collection("teams")

    clean_team_id = data.team_id.strip().upper()
    clean_team_name = data.team_name.strip()
    clean_leader_name = data.leader_name.strip()
    clean_email = data.email.strip().lower()
    clean_institution = data.institution.strip()

    # Rule 1: Registration must be performed by the Team Leader
    if not clean_leader_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Team Leader name is mandatory. Registration must be submitted by the Team Leader."
        )

    if not clean_team_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Team name is required."
        )

    if not clean_team_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Team ID is required."
        )

    if not clean_email or "@" not in clean_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A valid Team Leader email address is required."
        )

    # 2 ultra-fast index-accelerated checks + password hashing in parallel (<10ms total)
    team_check_task = asyncio.to_thread(
        teams_col.find_one,
        {
            "$or": [
                {"team_id": clean_team_id},
                {"team_id": clean_team_id.lower()},
                {"team_name": clean_team_name},
                {"email": clean_email}
            ]
        }
    )
    user_check_task = asyncio.to_thread(
        users_col.find_one,
        {
            "$or": [
                {"username": clean_team_id.lower()},
                {"team_id": clean_team_id},
                {"team_id": clean_team_id.lower()},
                {"email": clean_email}
            ]
        }
    )
    hash_task = asyncio.to_thread(get_password_hash, data.password)

    existing_team, existing_user, hashed_pwd = await asyncio.gather(
        team_check_task,
        user_check_task,
        hash_task
    )

    if existing_team:
        t_id = str(existing_team.get("team_id", "")).strip().upper()
        t_name = str(existing_team.get("team_name", "")).strip().lower()
        t_email = str(existing_team.get("email", "")).strip().lower()

        if t_id == clean_team_id or t_id.lower() == clean_team_id.lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Team ID '{clean_team_id}' is already registered. Teams must not have the same Team ID. Please enter a unique Team ID."
            )
        if t_name == clean_team_name.lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Team Name '{clean_team_name}' is already taken. Please choose a unique Team Name."
            )
        if t_email == clean_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Email '{clean_email}' is already registered with another team."
            )

    if existing_user:
        u_name = str(existing_user.get("username", "")).strip().lower()
        u_tid = str(existing_user.get("team_id", "")).strip().upper()
        u_email = str(existing_user.get("email", "")).strip().lower()

        if u_name == clean_team_id.lower() or u_tid == clean_team_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Team ID '{clean_team_id}' is already registered. Teams must not have the same Team ID. Please enter a unique Team ID."
            )
        if u_email == clean_email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Email '{clean_email}' is already registered with another team."
            )

    now = datetime.now(timezone.utc).isoformat()
    if not now.endswith("Z") and "+" not in now:
        now += "Z"
    new_team = {
        "team_id": clean_team_id,
        "team_name": clean_team_name,
        "leader_name": clean_leader_name,
        "email": clean_email,
        "institution": clean_institution,
        "members": [m.strip() for m in data.members if m.strip()],
        "status": TeamStatus.ACTIVE,
        "is_qualified_r3": False,
        "is_eliminated": False,
        "total_score": 0.0,
        "scores_by_round": {},
        "created_at": now,
        "registered_at": now
    }

    session_id = str(uuid.uuid4())

    # Create 1 dedicated login account per team with active session
    new_user = {
        "username": clean_team_id.lower(),
        "email": clean_email,
        "role": UserRole.PARTICIPANT,
        "team_id": clean_team_id,
        "team_name": clean_team_name,
        "leader_name": clean_leader_name,
        "hashed_password": hashed_pwd,
        "active_session": True,
        "active_session_token": session_id,
        "last_active": now,
        "created_at": now
    }

    # Parallel insertions backed by database uniqueness enforcement
    try:
        await asyncio.gather(
            asyncio.to_thread(teams_col.insert_one, new_team),
            asyncio.to_thread(users_col.insert_one, new_user)
        )
    except Exception as e:
        if "duplicate" in str(e).lower() or "11000" in str(e):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Team ID '{clean_team_id}' is already registered. Teams must not have the same Team ID. Please enter a unique Team ID."
            )
        raise e

    # Issue access token immediately so the participant can land on cockpit in <1s
    token_data = {
        "sub": clean_team_id.lower(),
        "role": UserRole.PARTICIPANT,
        "team_id": clean_team_id,
        "team_name": clean_team_name,
        "session_id": session_id
    }
    access_token = create_access_token(data=token_data)

    clean_user = {
        "username": clean_team_id.lower(),
        "email": clean_email,
        "role": UserRole.PARTICIPANT,
        "team_id": clean_team_id,
        "team_name": clean_team_name,
        "active_session": True,
        "active_session_token": session_id
    }
    set_cached_user(clean_team_id.lower(), clean_user)

    user_info = dict(clean_user)
    user_info["team"] = dict(new_team)

    # Broadcast registration immediately so Race Control HQ and Teams Page update in 0ms!
    try:
        await ws_manager.broadcast("TEAM_REGISTERED", {
            "team_id": clean_team_id,
            "team_name": clean_team_name,
            "leader_name": clean_leader_name,
            "email": clean_email,
            "institution": clean_institution,
            "team": new_team
        })
    except Exception as b_err:
        logger.warning(f"Failed to broadcast TEAM_REGISTERED: {b_err}")

    return {
        "message": f"Team '{clean_team_name}' ({clean_team_id}) registered successfully!",
        "team_id": clean_team_id,
        "username": clean_team_id.lower(),
        "access_token": access_token,
        "token_type": "bearer",
        "role": UserRole.PARTICIPANT,
        "user": user_info,
        "team": new_team
    }


@router.get("/me")
async def get_my_profile(current_user: dict = Depends(get_current_user)):
    user_info = dict(current_user)
    if current_user.get("role") == UserRole.PARTICIPANT and current_user.get("team_id"):
        teams_col = db_manager.get_collection("teams")
        team = await asyncio.to_thread(teams_col.find_one, {"team_id": current_user["team_id"]})
        if team:
            user_info["team"] = _apply_r3_rules_to_team(dict(team))
    return user_info
