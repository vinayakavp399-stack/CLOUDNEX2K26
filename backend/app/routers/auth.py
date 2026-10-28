import asyncio
from datetime import datetime, timezone
import logging
import re
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


@router.post("/login", response_model=Token)
async def login(credentials: LoginRequest, background_tasks: BackgroundTasks):
    t0 = datetime.utcnow().timestamp()
    identifier = credentials.username.strip().lower()
    users_col = db_manager.get_collection("users")
    t1 = datetime.utcnow().timestamp()
    logger.info(f"[PERF] Init took: {t1 - t0:.3f}s")
    
    # 1. Fast direct indexed lookup (O(1)) instead of downloading entire collection
    user = await asyncio.to_thread(
        users_col.find_one,
        {
            "$or": [
                {"username": identifier},
                {"email": identifier},
                {"team_id": identifier},
                {"team_id": identifier.upper()}
            ]
        }
    )
    t2 = datetime.utcnow().timestamp()
    logger.info(f"[PERF] find_one exact took: {t2 - t1:.3f}s (found: {bool(user)})")
    
    # Fallback to case-insensitive regex only if exact index match didn't find it
    if not user:
        user = await asyncio.to_thread(
            users_col.find_one,
            {
                "$or": [
                    {"username": {"$regex": f"^{re.escape(identifier)}$", "$options": "i"}},
                    {"email": {"$regex": f"^{re.escape(identifier)}$", "$options": "i"}},
                    {"team_id": {"$regex": f"^{re.escape(identifier)}$", "$options": "i"}}
                ]
            }
        )
        t2_regex = datetime.utcnow().timestamp()
        logger.info(f"[PERF] find_one regex took: {t2_regex - t2:.3f}s")

    # Fallback for admin: allow logging in using the standard 'admin' alias as well
    if not user and identifier.lower() == "admin":
        user = await asyncio.to_thread(users_col.find_one, {"role": UserRole.ADMIN})

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
    # If login is initiated from Admin portal, participant credentials must not be allowed.
    # If login is initiated from Participant portal, admin credentials must not be allowed.
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
    # (Admins can have multiple devices/sessions concurrently)
    if user.get("role") == UserRole.PARTICIPANT and user.get("team_id"):
        team_id = user["team_id"]
        # Verify whether an active session or active token exists in the database
        has_active_session = bool(user.get("active_session")) or bool(user.get("active_session_token"))
        has_live_ws = team_id in ws_manager.team_connections and len(ws_manager.team_connections[team_id]) > 0

        # Block if active on another device and user has not confirmed force takeover
        if (has_active_session or has_live_ws) and not getattr(credentials, "force", False):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Team '{team_id}' is already logged in on another device. Participants can only access from one device at a time."
            )

        # If another device was active and force=True, kick the old device out via WebSocket and close old sockets
        if has_active_session or has_live_ws:
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

    # Synchronously register active session in database and refresh cache
    user_id = user["_id"]
    await asyncio.to_thread(
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
    invalidate_user_cache(user["username"])

    # 5. Populate in-memory user cache immediately
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

    # 6. Pre-build user profile so frontend gets everything in 1 single fast trip
    user_info = dict(clean_user)
    team_data = None
    if user.get("role") == UserRole.PARTICIPANT and user.get("team_id"):
        teams_col = db_manager.get_collection("teams")
        team = teams_col.find_one({"team_id": user["team_id"]})
        if team:
            team_dict = dict(team)
            rounds_col = db_manager.get_collection("rounds")
            r3 = rounds_col.find_one({"round_number": 3})
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
            user_info["team"] = team_dict
            team_data = team_dict

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

    # Fast O(1) exact uniqueness check first
    existing_team = teams_col.find_one({
        "$or": [
            {"team_name": clean_team_name},
            {"email": clean_email},
            {"team_id": clean_team_id}
        ]
    })
    if existing_team:
        if existing_team.get("team_name", "").lower() == clean_team_name.lower():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Team Name '{clean_team_name}' is already taken.")
        if existing_team.get("email", "").lower() == clean_email.lower():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Email '{clean_email}' is already registered with another team.")
        if existing_team.get("team_id", "").upper() == clean_team_id.upper():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Team ID '{clean_team_id}' is already registered.")

    existing_user = users_col.find_one({
        "$or": [
            {"email": clean_email},
            {"username": clean_team_id.lower()},
            {"team_id": clean_team_id}
        ]
    })
    if existing_user:
        if existing_user.get("email", "").lower() == clean_email.lower():
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Email '{clean_email}' is already registered.")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Team ID '{clean_team_id}' is already registered.")

    # Compute password hash in worker thread to prevent event loop freeze
    hashed_pwd = await asyncio.to_thread(get_password_hash, data.password)

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
    teams_col.insert_one(new_team)

    # Create 1 dedicated login account per team
    new_user = {
        "username": clean_team_id.lower(),
        "email": clean_email,
        "role": UserRole.PARTICIPANT,
        "team_id": clean_team_id,
        "team_name": clean_team_name,
        "leader_name": clean_leader_name,
        "hashed_password": hashed_pwd,
        "created_at": now
    }
    users_col.insert_one(new_user)

    # Audit log
    audit_col = db_manager.get_collection("audit_logs")
    audit_col.insert_one({
        "action": "TEAM_REGISTERED",
        "actor": clean_team_id,
        "details": {
            "team_name": clean_team_name,
            "leader_name": clean_leader_name,
            "email": clean_email,
            "institution": clean_institution
        },
        "timestamp": now
    })

    return {
        "message": f"Team '{clean_team_name}' ({clean_team_id}) registered successfully by Team Leader {clean_leader_name}! You can now log in.",
        "team_id": clean_team_id,
        "username": clean_team_id.lower()
    }


@router.get("/me")
async def get_my_profile(current_user: dict = Depends(get_current_user)):
    user_info = dict(current_user)
    if current_user.get("role") == UserRole.PARTICIPANT and current_user.get("team_id"):
        teams_col = db_manager.get_collection("teams")
        team = teams_col.find_one({"team_id": current_user["team_id"]})
        if team:
            team_dict = dict(team)
            rounds_col = db_manager.get_collection("rounds")
            r3 = rounds_col.find_one({"round_number": 3})
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
            user_info["team"] = team_dict
    return user_info
