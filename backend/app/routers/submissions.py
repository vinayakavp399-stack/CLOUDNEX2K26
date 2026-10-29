import asyncio
import base64
from datetime import datetime
import mimetypes
import os
from pathlib import Path
import shutil
from typing import List, Optional
import uuid
from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile, status
from fastapi.responses import FileResponse
from app.auth import get_current_participant, get_current_user
from app.config import settings
from app.database import db_manager
from app.models import RoundState, UserRole
from app.websocket_manager import ws_manager

router = APIRouter(prefix="/submissions", tags=["Submissions"])

ALLOWED_EXTENSIONS = {".zip", ".tar.gz", ".pdf", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".json", ".yaml", ".yml", ".md"}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB


@router.get("/my")
async def get_my_submissions(current_participant: dict = Depends(get_current_participant)):
    submissions_col = db_manager.get_collection("submissions")
    team_id = current_participant["team_id"]
    subs = await asyncio.to_thread(submissions_col.find, {"team_id": team_id})
    return sorted(subs, key=lambda s: s.get("round_number", 0))


@router.get("/team/{team_id}/round/{round_number}")
async def get_team_round_submission(
    team_id: str,
    round_number: int,
    current_user: dict = Depends(get_current_user)
):
    # Security Rule: Only admin or the specific team can access this submission
    if current_user["role"] != UserRole.ADMIN and current_user.get("team_id") != team_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You cannot access another team's submission."
        )

    submissions_col = db_manager.get_collection("submissions")
    sub = submissions_col.find_one({"team_id": team_id, "round_number": round_number})
    if not sub:
        return None
    return sub


@router.post("")
async def create_or_update_submission(
    round_number: int = Form(...),
    github_url: Optional[str] = Form(None),
    deployed_url: Optional[str] = Form(None),
    deployment_instructions: Optional[str] = Form(None),
    implementation_summary: Optional[str] = Form(None),
    architecture_notes: Optional[str] = Form(None),
    recovery_strategy: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    current_participant: dict = Depends(get_current_participant)
):
    team_id = current_participant["team_id"]
    team_name = current_participant["team_name"]

    rounds_col = db_manager.get_collection("rounds")
    teams_col = db_manager.get_collection("teams")
    submissions_col = db_manager.get_collection("submissions")
    audit_col = db_manager.get_collection("audit_logs")

    # 1. Check Round Status
    r = rounds_col.find_one({"round_number": round_number})
    if not r:
        raise HTTPException(status_code=404, detail="Specified round does not exist.")

    # 1. Check Round Status & Submissions Open flag
    is_live = r.get("status") == RoundState.LIVE
    is_submissions_open = bool(r.get("submissions_open", False))

    if not is_live and not is_submissions_open:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Submissions for Round {round_number} are currently closed. Race Control has not opened submissions."
        )

    # 2. Check Deadline on Server (only if submissions_open is not explicitly enabled by admin)
    now = datetime.utcnow()
    deadline_str = r.get("deadline")
    is_late = False
    if deadline_str and not is_submissions_open:
        try:
            deadline_dt = datetime.fromisoformat(deadline_str.replace("Z", "+00:00")).replace(tzinfo=None)
            if now > deadline_dt:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Submission deadline has passed for Round {round_number}. The server has locked submissions."
                )
        except HTTPException:
            raise
        except Exception:
            pass

    # 3. Check Qualification if Round 3
    team_doc = teams_col.find_one({"team_id": team_id})
    if round_number == 3:
        if not team_doc or not team_doc.get("is_qualified_r3") or team_doc.get("is_eliminated"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access Denied: Your team is not qualified for Round 3 (Final Lap)."
            )

    # 4. Check single submission rule for Round 1 and Round 2
    existing_sub = submissions_col.find_one({"team_id": team_id, "round_number": round_number})
    if round_number in (1, 2) and existing_sub:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Your team has already submitted for Round {round_number}. Only 1 submission is permitted and further submissions are locked."
        )

    # 5. Handle File Upload (stored strictly in MongoDB Atlas, no physical disk)
    file_record_path = None
    original_filename = None
    file_base64 = None
    file_content_type = None
    file_size_bytes = None

    if round_number == 1:
        # Round 1 accepts architecture blueprint file (under 2MB) and/or GitHub repository link
        if not (file and file.filename) and not (github_url and github_url.strip()):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="In Round 1, please provide your architecture blueprint file (under 2MB) or your GitHub repository link."
            )
        
        if file and file.filename:
            file_bytes = await file.read()
            file_size_bytes = len(file_bytes)
            if file_size_bytes > 2 * 1024 * 1024:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"File size ({file_size_bytes / (1024*1024):.2f}MB) exceeds the 2MB limit for Round 1. Please upload a file under 2MB."
                )

            original_filename = file.filename
            ext = Path(original_filename).suffix.lower()
            round1_allowed = {".pdf", ".png", ".jpg", ".jpeg", ".webp", ".gif"}
            if ext not in round1_allowed:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Unsupported format '{ext}' for Round 1. Only documents (PDF) or images/animations (PNG, JPG, JPEG, GIF, WEBP) under 2MB are accepted."
                )

            safe_filename = f"{team_id}_r{round_number}_{uuid.uuid4().hex[:8]}{ext}"
            file_record_path = safe_filename
            file_content_type = mimetypes.guess_type(original_filename)[0] or file.content_type or "application/octet-stream"
            file_base64 = base64.b64encode(file_bytes).decode("utf-8")

        # Keep github_url if provided for Round 1, clear deployed_url
        if github_url:
            github_url = github_url.strip()
        deployed_url = None

    elif round_number == 2:
        if not github_url or not github_url.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="In Round 2, GitHub repository URL is required."
            )
        if not deployed_url or not deployed_url.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="In Round 2, Live deployed application URL is required."
            )
        # Store Round 2 files in the exact same file_data/file_path/file_name columns in Atlas (max 2MB)
        if file and file.filename:
            file_bytes = await file.read()
            file_size_bytes = len(file_bytes)
            if file_size_bytes > 2 * 1024 * 1024:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"File size ({file_size_bytes / (1024*1024):.2f}MB) exceeds the 2MB limit for Round 2. Please upload a file under 2MB."
                )

            original_filename = file.filename
            ext = Path(original_filename).suffix.lower()
            if ext not in ALLOWED_EXTENSIONS:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Unsupported format '{ext}' for Round 2. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
                )

            safe_filename = f"{team_id}_r{round_number}_{uuid.uuid4().hex[:8]}{ext}"
            file_record_path = safe_filename
            file_content_type = mimetypes.guess_type(original_filename)[0] or file.content_type or "application/octet-stream"
            file_base64 = base64.b64encode(file_bytes).decode("utf-8")

    elif file and file.filename:
        file_bytes = await file.read()
        file_size_bytes = len(file_bytes)
        if file_size_bytes > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File exceeds maximum allowed size ({MAX_FILE_SIZE / (1024*1024):.0f}MB)."
            )

        original_filename = file.filename
        ext = Path(original_filename).suffix.lower()
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file format '{ext}'. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
            )

        safe_filename = f"{team_id}_r{round_number}_{uuid.uuid4().hex[:8]}{ext}"
        file_record_path = safe_filename
        file_content_type = mimetypes.guess_type(original_filename)[0] or file.content_type or "application/octet-stream"
        file_base64 = base64.b64encode(file_bytes).decode("utf-8")

    sub_data = {
        "team_id": team_id,
        "team_name": team_name,
        "round_number": round_number,
        "github_url": github_url.strip() if github_url else (existing_sub.get("github_url") if existing_sub else None),
        "deployed_url": deployed_url.strip() if deployed_url else (existing_sub.get("deployed_url") if existing_sub else None),
        "deployment_instructions": deployment_instructions.strip() if deployment_instructions else (existing_sub.get("deployment_instructions") if existing_sub else None),
        "implementation_summary": implementation_summary.strip() if implementation_summary else (existing_sub.get("implementation_summary") if existing_sub else None),
        "architecture_notes": architecture_notes.strip() if architecture_notes else (existing_sub.get("architecture_notes") if existing_sub else None),
        "recovery_strategy": recovery_strategy.strip() if recovery_strategy else (existing_sub.get("recovery_strategy") if existing_sub else None),
        "file_path": file_record_path if file_record_path else (existing_sub.get("file_path") if existing_sub else None),
        "file_name": original_filename if original_filename else (existing_sub.get("file_name") if existing_sub else None),
        "file_data": file_base64 if file_base64 else (existing_sub.get("file_data") if existing_sub else None),
        "file_content_type": file_content_type if file_content_type else (existing_sub.get("file_content_type") if existing_sub else None),
        "file_size": file_size_bytes if file_size_bytes else (existing_sub.get("file_size") if existing_sub else None),
        "submitted_at": now.isoformat(),
        "is_late": is_late,
        "score": existing_sub.get("score") if existing_sub else None,
        "feedback": existing_sub.get("feedback") if existing_sub else None
    }

    if existing_sub:
        submissions_col.update_one({"team_id": team_id, "round_number": round_number}, {"$set": sub_data})
        action = "SUBMISSION_UPDATED"
    else:
        submissions_col.insert_one(sub_data)
        action = "SUBMISSION_CREATED"

    # Audit log
    audit_col.insert_one({
        "action": action,
        "actor": team_id,
        "details": {"round_number": round_number, "has_file": bool(file_record_path or (existing_sub and existing_sub.get("file_path")))},
        "timestamp": now.isoformat()
    })

    # Broadcast race director event with full submission preview
    await ws_manager.broadcast("NEW_SUBMISSION", {
        "team_id": team_id,
        "team_name": team_name,
        "round_number": round_number,
        "github_url": github_url or (existing_sub and existing_sub.get("github_url")),
        "deployed_url": deployed_url or (existing_sub and existing_sub.get("deployed_url")),
        "file_name": file.filename if file else (existing_sub and existing_sub.get("file_name")),
        "has_file": bool(file_record_path or (existing_sub and existing_sub.get("file_path"))),
        "submitted_at": now.isoformat()
    })

    return {
        "message": f"Round {round_number} submission successfully received and verified!",
        "submitted_at": now.isoformat(),
        "round_number": round_number
    }


@router.get("/download/{filename}")
async def download_submission_file(filename: str, current_user: dict = Depends(get_current_user)):
    submissions_col = db_manager.get_collection("submissions")
    sub = submissions_col.find_one({"$or": [{"file_path": filename}, {"file_name": filename}]})

    if sub and sub.get("file_data"):
        is_admin = current_user["role"] == UserRole.ADMIN
        if not is_admin and sub.get("team_id") != current_user.get("team_id"):
            raise HTTPException(status_code=403, detail="Unauthorized access to team artifact.")
        raw_bytes = base64.b64decode(sub["file_data"])
        content_type = sub.get("file_content_type") or "application/octet-stream"
        return Response(
            content=raw_bytes,
            media_type=content_type,
            headers={"Content-Disposition": f'attachment; filename="{sub.get("file_name", filename)}"'}
        )

    # Fallback to physical disk if file existed previously
    file_path = settings.UPLOAD_DIR / filename
    if file_path.exists():
        is_admin = current_user["role"] == UserRole.ADMIN
        if not is_admin and not filename.startswith(current_user.get("team_id", "___")):
            raise HTTPException(status_code=403, detail="Unauthorized access to team artifact.")
        return FileResponse(path=file_path, filename=filename)

    raise HTTPException(status_code=404, detail="File not found")


@router.get("/file/{filename}")
async def view_submission_file(filename: str):
    """Serve uploaded submission file/photo inline directly from MongoDB Atlas."""
    submissions_col = db_manager.get_collection("submissions")
    sub = submissions_col.find_one({"$or": [{"file_path": filename}, {"file_name": filename}]})

    if sub and sub.get("file_data"):
        raw_bytes = base64.b64decode(sub["file_data"])
        content_type = sub.get("file_content_type") or mimetypes.guess_type(sub.get("file_name", filename))[0] or "application/octet-stream"
        return Response(
            content=raw_bytes,
            media_type=content_type,
            headers={"Content-Disposition": f'inline; filename="{sub.get("file_name", filename)}"'}
        )

    # Fallback to physical disk if file existed previously
    file_path = settings.UPLOAD_DIR / filename
    if file_path.exists():
        return FileResponse(path=file_path)

    raise HTTPException(status_code=404, detail="Submission file not found")


