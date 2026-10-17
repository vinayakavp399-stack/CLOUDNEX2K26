import os
import sys
from pathlib import Path

# Redirect to backend/change_admin.py
root_dir = Path(__file__).resolve().parent
backend_dir = root_dir / "backend"
sys.path.insert(0, str(backend_dir))

from change_admin import change_admin
import argparse

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Change Admin Username, Email, and Password")
    parser.add_argument("--username", "-u", type=str, help="New admin username")
    parser.add_argument("--email", "-e", type=str, help="New admin email")
    parser.add_argument("--password", "-p", type=str, help="New admin password")
    args = parser.parse_args()

    change_admin(args.username, args.email, args.password)
