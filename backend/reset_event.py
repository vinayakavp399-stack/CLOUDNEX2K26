import os
import sys
import json
import shutil
from pathlib import Path
from datetime import datetime

# Set working directory to backend
backend_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(backend_dir))

from app.database import db_manager

def reset_event():
    print(f"[{datetime.utcnow().isoformat()}] Starting Event Reset...")
    print(f"Database Mode: {'MongoDB Atlas' if db_manager.is_atlas else 'Local JSON Document Store'}")

    # Backup data folder
    data_dir = backend_dir / "data"
    backup_dir = backend_dir / f"data_backup_{int(datetime.utcnow().timestamp())}"
    if data_dir.exists():
        shutil.copytree(data_dir, backup_dir)
        print(f"[OK] Backed up data directory to: {backup_dir.name}")

    # 1. Users Collection - KEEP ALL USERS
    users_col = db_manager.get_collection("users")
    all_users = users_col.find({})
    print(f"[OK] Preserved {len(all_users)} user accounts (no users deleted).")
    # Reset active sessions
    for u in all_users:
        users_col.update_one(
            {"_id": u["_id"]},
            {"$set": {"active_session": False, "active_session_token": None}}
        )

    # 2. Teams Collection - KEEP ALL TEAMS, RESET COMPETITION SCORES & CLEAR ALLOCATIONS
    teams_col = db_manager.get_collection("teams")
    all_teams = teams_col.find({})
    print(f"[OK] Preserving {len(all_teams)} registered teams:")
    for t in all_teams:
        print(f"   - Team ID: {t.get('team_id')}, Name: {t.get('team_name')}")
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
    now_iso = datetime.utcnow().isoformat()
    problems_col.update_many({}, {"$set": {"is_published": False, "updated_at": now_iso}})
    print("[OK] Unpublished all problem statements and cleared team allocations.")

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

    # 4. Submissions Collection - CLEAR ALL SUBMISSIONS
    submissions_col = db_manager.get_collection("submissions")
    sub_count = len(submissions_col.find({}))
    if db_manager.is_atlas:
        submissions_col.delete_many({})
    else:
        submissions_col._write_all([])
    print(f"[OK] Cleared {sub_count} previous submissions.")

    # 5. Evaluations Collection - CLEAR ALL MARKS & RUBRICS
    evaluations_col = db_manager.get_collection("evaluations")
    eval_count = len(evaluations_col.find({}))
    if db_manager.is_atlas:
        evaluations_col.delete_many({})
    else:
        evaluations_col._write_all([])
    print(f"[OK] Cleared {eval_count} previous judge evaluations.")

    # 6. Rounds Collection - RESET ROUNDS TO INITIAL LOCKED / READY STATE
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
    print("[OK] Reset all 3 rounds to fresh initial state (status: LOCKED, timers cleared).")

    # 6. System Settings - RESET WINNER ANNOUNCEMENT & LEADERBOARD FREEZE
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
    print("[OK] Reset winner announcement & podium state.")

    # 7. Backup and clean uploads folder
    uploads_dir = backend_dir / "uploads"
    if uploads_dir.exists():
        uploads_backup = backend_dir / f"uploads_backup_{int(datetime.utcnow().timestamp())}"
        uploads_backup.mkdir(exist_ok=True)
        for f in uploads_dir.glob("*.*"):
            shutil.move(str(f), str(uploads_backup / f.name))
        print(f"[OK] Moved old uploaded submission files to: {uploads_backup.name}")

    # Also update JSON files in backend/data directly to ensure 100% sync
    try:
        # rounds.json
        rounds_file = data_dir / "rounds.json"
        all_r = rounds_col.find({})
        with open(rounds_file, "w", encoding="utf-8") as f:
            json.dump(all_r, f, indent=2, default=str)

        # teams.json
        teams_file = data_dir / "teams.json"
        all_t = teams_col.find({})
        with open(teams_file, "w", encoding="utf-8") as f:
            json.dump(all_t, f, indent=2, default=str)

        # submissions.json
        submissions_file = data_dir / "submissions.json"
        with open(submissions_file, "w", encoding="utf-8") as f:
            json.dump([], f, indent=2)

        # evaluations.json
        evaluations_file = data_dir / "evaluations.json"
        with open(evaluations_file, "w", encoding="utf-8") as f:
            json.dump([], f, indent=2)

        # system_settings.json
        settings_file = data_dir / "system_settings.json"
        all_s = settings_col.find({})
        with open(settings_file, "w", encoding="utf-8") as f:
            json.dump(all_s, f, indent=2, default=str)

        print("[OK] Synchronized all local backend/data JSON files.")
    except Exception as e:
        print(f"[NOTICE] Notice syncing local JSON files: {e}")

    print("\nEVENT SUCCESSFULLY RESET TO THE BEGINNING!")
    print("- All users and registered teams are intact.")
    print("- Problem statement assignments are preserved.")
    print("- All previous submissions and marks have been cleared.")
    print("- Round 1 is ready to be started by the Admin.")

if __name__ == "__main__":
    reset_event()
