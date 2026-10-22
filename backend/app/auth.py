from datetime import datetime, timedelta
from typing import Optional
import re
import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from app.config import settings
from app.database import db_manager
from app.models import TokenData, UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/token", auto_error=False)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt


def decode_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except Exception:
        return None


# In-memory user profile cache to prevent repeated remote Atlas roundtrips
_user_cache: dict = {}
_USER_CACHE_TTL = 45  # seconds

def _get_user_from_cache_or_db(username: str) -> Optional[dict]:
    now = datetime.utcnow().timestamp()
    if username in _user_cache:
        user_data, ts = _user_cache[username]
        if now - ts < _USER_CACHE_TTL:
            return user_data

    users_col = db_manager.get_collection("users")
    user = users_col.find_one({"username": username})
    if not user:
        # Case-insensitive search
        user = users_col.find_one({"username": {"$regex": f"^{re.escape(username)}$", "$options": "i"}})

    # Backward compatibility: if token was issued for 'admin' before admin was renamed
    if not user and username.lower() == "admin":
        user = users_col.find_one({"role": UserRole.ADMIN})

    if not user:
        return None

    clean_user = {
        "username": user["username"],
        "email": user.get("email"),
        "role": user.get("role"),
        "team_id": user.get("team_id"),
        "team_name": user.get("team_name"),
        "active_session": user.get("active_session", True),
        "active_session_token": user.get("active_session_token")
    }
    _user_cache[username] = (clean_user, now)
    return clean_user

def set_cached_user(username: str, clean_user: dict):
    now = datetime.utcnow().timestamp()
    _user_cache[username] = (clean_user, now)

def invalidate_user_cache(username: Optional[str] = None):
    if username and username in _user_cache:
        del _user_cache[username]
    elif not username:
        _user_cache.clear()


async def get_optional_user(token: Optional[str] = Depends(oauth2_scheme)) -> Optional[dict]:
    if not token:
        return None
    payload = decode_token(token)
    if payload is None:
        return None
    username: str = payload.get("sub")
    if not username:
        return None
    return _get_user_from_cache_or_db(username)


async def get_current_user(token: Optional[str] = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception

    payload = decode_token(token)
    if payload is None:
        raise credentials_exception

    username: str = payload.get("sub")
    role: str = payload.get("role")
    session_id: Optional[str] = payload.get("session_id")
    if username is None or role is None:
        raise credentials_exception

    user = _get_user_from_cache_or_db(username)
    # If the token has role 'admin' and user wasn't found by previous username
    if user is None and role == UserRole.ADMIN:
        users_col = db_manager.get_collection("users")
        admin_doc = users_col.find_one({"role": UserRole.ADMIN})
        if admin_doc:
            user = {
                "username": admin_doc["username"],
                "email": admin_doc.get("email"),
                "role": admin_doc.get("role"),
                "team_id": admin_doc.get("team_id"),
                "team_name": admin_doc.get("team_name"),
                "active_session": admin_doc.get("active_session", True),
                "active_session_token": admin_doc.get("active_session_token")
            }

    if user is None:
        raise credentials_exception

    # Enforce single device login for participants:
    # Admin can access from multiple devices (no single device restriction).
    # Participants can only have 1 active device session.
    if user.get("role") == UserRole.PARTICIPANT:
        active_token = user.get("active_session_token")
        # If user explicitly logged out
        if user.get("active_session") is False:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session has been logged out. Please sign in again.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        # If account has an active session token and another device logged in (session_ids do not match)
        if active_token and session_id and active_token != session_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Your session was terminated because this account was logged into on another device.",
                headers={"WWW-Authenticate": "Bearer"},
            )

    return user


async def get_current_admin(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to Race Director (Admin) only."
        )
    return current_user


async def get_current_participant(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != UserRole.PARTICIPANT:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to registered participants."
        )
    return current_user
