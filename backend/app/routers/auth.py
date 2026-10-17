import asyncio
from datetime import datetime
import logging
import re
import uuid
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from app.auth import create_access_token, get_current_user, get_password_hash, set_cached_user, verify_password
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

    # 3. Enforce single device login: Prevent multiple logins from the same team
    if user.get("role") == UserRole.PARTICIPANT and user.get("team_id"):
        team_id = user["team_id"]
        # Check active live websocket connection
        has_live_ws = team_id in ws_manager.team_connections and len(ws_manager.team_connections[team_id]) > 0
        
        # Check active session recorded in database with recent activity (within 90 seconds)
        has_recent_session = False
        if user.get("active_session") and user.get("last_active"):
            try:
                last_dt = datetime.fromisoformat(user["last_active"])
                if (datetime.utcnow() - last_dt).total_seconds() < 90:
                    has_recent_session = True
            except Exception:
                pass

        if has_live_ws or has_recent_session:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Team '{team_id}' is already logged in on another device. Multiple logins from the same team are not allowed."
            )

    # 4. Generate token and session id
    session_id = str(uuid.uuid4())
    now_iso = datetime.utcnow().isoformat()

    # Register active session in background task so HTTP response returns instantly
    user_id = user["_id"]
    def _update_session_task():
        try:
            users_col.update_one(
                {"_id": user_id},
                {
                    "$set": {
                        "active_session": True,
                        "active_session_token": session_id,
                        "last_active": now_iso
                    }
                }
            )
        except Exception as e:
            logger.warning(f"Failed to record session update in background: {e}")

    background_tasks.add_task(_update_session_task)

    # 5. Populate in-memory user cache immediately
    clean_user = {
        "username": user["username"],
        "email": user.get("email"),
        "role": user["role"],
        "team_id": user.get("team_id"),
        "team_name": user.get("team_name")
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
            is_revealed = bool(not is_held and (r3.get("selection_revealed") or r3.get("results_announced"))) if r3 else False
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
    """Ends the active session and allows login on another device."""
    if current_user.get("team_id"):
        team_id = current_user["team_id"]
        users_col = db_manager.get_collection("users")
        users_col.update_one(
            {"team_id": team_id},
            {"$set": {"active_session": False, "active_session_token": None}}
        )
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

    # Rule 2: Strict Uniqueness on Team Name (Case-insensitive)
    existing_team_name = teams_col.find_one({
        "team_name": {"$regex": f"^{re.escape(clean_team_name)}$", "$options": "i"}
    })
    if existing_team_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Team Name '{clean_team_name}' is already taken. Each team must have a unique team name."
        )

    # Rule 3: Strict Uniqueness on Email (Case-insensitive across both teams and users)
    existing_email_user = users_col.find_one({
        "email": {"$regex": f"^{re.escape(clean_email)}$", "$options": "i"}
    })
    existing_email_team = teams_col.find_one({
        "email": {"$regex": f"^{re.escape(clean_email)}$", "$options": "i"}
    })
    if existing_email_user or existing_email_team:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Email '{clean_email}' is already registered with another team. Each team leader must register with a unique email."
        )

    # Rule 4: Strict Uniqueness on Team ID (1 team per 1 login)
    existing_team_id = teams_col.find_one({
        "team_id": {"$regex": f"^{re.escape(clean_team_id)}$", "$options": "i"}
    })
    existing_user_id = users_col.find_one({
        "username": {"$regex": f"^{re.escape(clean_team_id)}$", "$options": "i"}
    })
    if existing_team_id or existing_user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Team ID '{clean_team_id}' is already registered. Only 1 team per login is permitted."
        )

    now = datetime.utcnow().isoformat()
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
        "created_at": now
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
        "hashed_password": get_password_hash(data.password),
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
            is_revealed = bool(not is_held and (r3.get("selection_revealed") or r3.get("results_announced"))) if r3 else False
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
