import os
import sys
import json
import shutil
from pathlib import Path
from datetime import datetime

backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

from app.database import db_manager
from app.models import UserRole

def purge_participants_and_teams():
    print(f"[{datetime.utcnow().isoformat()}] Purging all participants and teams...")
    print(f"Database Mode: {'MongoDB Atlas' if db_manager.is_atlas else 'Local JSON Document Store'}")

    data_dir = backend_dir / "data"
    backup_dir = backend_dir / f"data_backup_before_purge_{int(datetime.utcnow().timestamp())}"
    if data_dir.exists():
        shutil.copytree(data_dir, backup_dir)
        print(f"[OK] Backed up data directory to: {backup_dir.name}")

    # 1. Users Collection: Remove all users EXCEPT admin
    users_col = db_manager.get_collection("users")
    all_users = list(users_col.find({}))
    deleted_users_count = 0
    preserved_admin = None

    for u in all_users:
        if u.get("role") == UserRole.ADMIN or u.get("role") == "admin":
            preserved_admin = u
            users_col.update_one(
                {"_id": u["_id"]},
                {"$set": {
                    "active_session": False,
                    "active_session_token": None,
                    "team_id": None,
                    "team_name": "Race Control HQ"
                }}
            )
        else:
            if db_manager.is_atlas:
                users_col.delete_one({"_id": u["_id"]})
            deleted_users_count += 1

    if not db_manager.is_atlas:
        admin_list = [preserved_admin] if preserved_admin else []
        users_col._write_all(admin_list)

    print(f"[OK] Deleted {deleted_users_count} participant users.")
    print(f"[OK] Preserved Admin: {preserved_admin.get('username') if preserved_admin else 'None'}")

    # 2. Teams Collection: Remove ALL teams
    teams_col = db_manager.get_collection("teams")
    teams_count = len(list(teams_col.find({})))
    if db_manager.is_atlas:
        teams_col.delete_many({})
    else:
        teams_col._write_all([])
    print(f"[OK] Deleted {teams_count} teams. Teams collection is now empty.")

    # 3. Submissions Collection: Remove ALL submissions
    submissions_col = db_manager.get_collection("submissions")
    if db_manager.is_atlas:
        submissions_col.delete_many({})
    else:
        submissions_col._write_all([])
    print("[OK] Submissions collection cleared.")

    # 4. Evaluations Collection: Remove ALL evaluations
    evaluations_col = db_manager.get_collection("evaluations")
    if db_manager.is_atlas:
        evaluations_col.delete_many({})
    else:
        evaluations_col._write_all([])
    print("[OK] Evaluations collection cleared.")

    # 5. Allocations Collection: Remove ALL problem allocations
    allocations_col = db_manager.get_collection("allocations")
    if db_manager.is_atlas:
        allocations_col.delete_many({})
    else:
        allocations_col._write_all([])
    print("[OK] Allocations collection cleared.")

    # 6. Allocation Config: Reset to fresh unallocated state
    config_col = db_manager.get_collection("allocation_config")
    now_iso = datetime.utcnow().isoformat()
    config_col.update_one(
        {"_id": "global_allocation_config"},
        {"$set": {
            "_id": "global_allocation_config",
            "is_finalized": False,
            "batch_id": None,
            "last_allocated_at": None,
            "max_teams_per_problem": 5,
            "is_automatic_enabled": True,
            "updated_at": now_iso
        }},
        upsert=True
    )
    print("[OK] Allocation configuration reset.")

    # 7. Problem Statements: Unpublish all
    problems_col = db_manager.get_collection("problem_statements")
    problems_col.update_many({}, {"$set": {"is_published": False, "updated_at": now_iso}})
    print("[OK] All problem statements unpublished.")

    # 8. Rounds: Reset all to locked with problem_published=False
    rounds_col = db_manager.get_collection("rounds")
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
    print("[OK] Reset all 3 rounds to LOCKED state.")

    # 9. System Settings: Reset winner announcement and podium
    settings_col = db_manager.get_collection("system_settings")
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
    print("[OK] Reset system settings and winner announcements.")

    # 10. Clean uploads folder
    uploads_dir = backend_dir / "uploads"
    if uploads_dir.exists():
        uploads_backup = backend_dir / f"uploads_backup_{int(datetime.utcnow().timestamp())}"
        uploads_backup.mkdir(exist_ok=True)
        for f in uploads_dir.glob("*.*"):
            try:
                shutil.move(str(f), str(uploads_backup / f.name))
            except Exception:
                pass
        print(f"[OK] Uploaded files moved to backup.")

    # 11. Sync local JSON files directly in backend/data
    try:
        # users.json
        users_file = data_dir / "users.json"
        all_u = users_col.find({})
        with open(users_file, "w", encoding="utf-8") as f:
            json.dump(all_u, f, indent=2, default=str)

        # teams.json
        teams_file = data_dir / "teams.json"
        with open(teams_file, "w", encoding="utf-8") as f:
            json.dump([], f, indent=2)

        # submissions.json
        submissions_file = data_dir / "submissions.json"
        with open(submissions_file, "w", encoding="utf-8") as f:
            json.dump([], f, indent=2)

        # evaluations.json
        evaluations_file = data_dir / "evaluations.json"
        with open(evaluations_file, "w", encoding="utf-8") as f:
            json.dump([], f, indent=2)

        # allocations.json
        allocations_file = data_dir / "allocations.json"
        with open(allocations_file, "w", encoding="utf-8") as f:
            json.dump([], f, indent=2)

        # rounds.json
        rounds_file = data_dir / "rounds.json"
        all_r = rounds_col.find({})
        with open(rounds_file, "w", encoding="utf-8") as f:
            json.dump(all_r, f, indent=2, default=str)

        # problem_statements.json
        problems_file = data_dir / "problem_statements.json"
        all_p = problems_col.find({})
        with open(problems_file, "w", encoding="utf-8") as f:
            json.dump(all_p, f, indent=2, default=str)

        # system_settings.json
        settings_file = data_dir / "system_settings.json"
        all_s = settings_col.find({})
        with open(settings_file, "w", encoding="utf-8") as f:
            json.dump(all_s, f, indent=2, default=str)

        print("[OK] Synchronized all local JSON files in backend/data.")
    except Exception as e:
        print(f"[NOTICE] Syncing local files: {e}")

    print("\nPURGE COMPLETE: All teams, participants, submissions, evaluations, and allocations have been deleted.")
    print("Only the Admin user remains.")

if __name__ == "__main__":
    purge_participants_and_teams()
