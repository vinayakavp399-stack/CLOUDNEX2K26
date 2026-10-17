import argparse
import sys
import re
from pathlib import Path

# Paths
backend_dir = Path(__file__).resolve().parent
project_root = backend_dir.parent
sys.path.insert(0, str(backend_dir))

from app.database import db_manager
from app.auth import get_password_hash
from app.models import UserRole

def update_env_file(filepath: Path, username: str, email: str, password: str):
    if not filepath.exists():
        return
    content = filepath.read_text(encoding="utf-8")
    if username:
        content = re.sub(r'DEFAULT_ADMIN_USERNAME=.*', f'DEFAULT_ADMIN_USERNAME="{username}"', content)
    if email:
        content = re.sub(r'DEFAULT_ADMIN_EMAIL=.*', f'DEFAULT_ADMIN_EMAIL="{email}"', content)
    if password:
        content = re.sub(r'DEFAULT_ADMIN_PASSWORD=.*', f'DEFAULT_ADMIN_PASSWORD="{password}"', content)
    filepath.write_text(content, encoding="utf-8")
    print(f"[OK] Updated environment file: {filepath.name}")

def change_admin(username=None, email=None, password=None):
    print("=== Update Admin Credentials ===")
    users_col = db_manager.get_collection("users")
    admin_user = users_col.find_one({"role": UserRole.ADMIN})

    if not admin_user:
        print("[ERROR] No admin account found in the database.")
        return

    update_fields = {}
    if username:
        update_fields["username"] = username
    if email:
        update_fields["email"] = email
    if password:
        update_fields["hashed_password"] = get_password_hash(password)

    if update_fields:
        users_col.update_one({"_id": admin_user["_id"]}, {"$set": update_fields})
        print(f"[OK] Database updated successfully!")

        # Also update both .env files
        backend_env = backend_dir / ".env"
        root_env = project_root / ".env"
        update_env_file(backend_env, username, email, password)
        update_env_file(root_env, username, email, password)

        # Also sync local data/users.json if needed
        data_users = backend_dir / "data" / "users.json"
        if data_users.exists():
            import json
            try:
                all_u = users_col.find({})
                with open(data_users, "w", encoding="utf-8") as f:
                    json.dump(all_u, f, indent=2, default=str)
                print("[OK] Synced local backend/data/users.json")
            except Exception as e:
                print(f"[NOTICE] {e}")

        updated_admin = users_col.find_one({"_id": admin_user["_id"]})
        print("\n=== Current Admin Credentials ===")
        print(f"Username: {updated_admin.get('username')}")
        print(f"Email:    {updated_admin.get('email')}")
        if password:
            print(f"Password: {password}")
        else:
            print("Password: (unchanged)")
    else:
        print("Current Admin Info:")
        print(f"Username: {admin_user.get('username')}")
        print(f"Email:    {admin_user.get('email')}")
        print("\nTo update, run:")
        print("python change_admin.py --username <new_username> --email <new_email> --password <new_password>")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Change Admin Username, Email, and Password")
    parser.add_argument("--username", "-u", type=str, help="New admin username")
    parser.add_argument("--email", "-e", type=str, help="New admin email")
    parser.add_argument("--password", "-p", type=str, help="New admin password")
    args = parser.parse_args()

    change_admin(args.username, args.email, args.password)
