import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.config import settings
from app.database import db_manager

rounds_col = db_manager.get_collection("rounds")
teams_col = db_manager.get_collection("teams")
client = TestClient(app)

@pytest.fixture(scope="session", autouse=True)
def clean_database_after_tests():
    yield
    # Clean up test teams, submissions, and participant users after test run
    teams_col.delete_many({})
    db_manager.get_collection("submissions").delete_many({})
    db_manager.get_collection("evaluations").delete_many({})
    db_manager.get_collection("allocations").delete_many({})
    db_manager.get_collection("users").delete_many({"role": {"$ne": "admin"}})
    rounds_col.update_many({}, {"$set": {"selection_revealed": False, "results_announced": False, "results_timer_active": False}})
    rounds_col.update_one({"round_number": 1}, {"$set": {"status": "LIVE", "is_active": True}})
    rounds_col.update_one({"round_number": 2}, {"$set": {"status": "LOCKED", "is_active": False}})
    rounds_col.update_one({"round_number": 3}, {"$set": {"status": "LOCKED", "is_active": False}})

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] in ["GREEN_FLAG", "ok"]

def test_admin_login_success():
    response = client.post("/api/v1/auth/login", json={
        "username": settings.DEFAULT_ADMIN_USERNAME,
        "password": settings.DEFAULT_ADMIN_PASSWORD
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["role"] == "admin"

def test_invalid_login():
    response = client.post("/api/v1/auth/login", json={
        "username": "invalid_user",
        "password": "wrong_password"
    })
    assert response.status_code == 401

def test_participant_login_success():
    # Register team first if not present
    client.post("/api/v1/auth/register-participant", json={
        "team_id": "TEAM-RED-BULL-01",
        "team_name": "Red Bull Racing",
        "leader_name": "Max Verstappen",
        "email": "max.v@example.com",
        "password": "Password@123",
        "institution": "GM University",
        "members": ["Member 1"]
    })
    response = client.post("/api/v1/auth/login", json={
        "username": "team-red-bull-01",
        "password": "Password@123",
        "force": True
    })
    assert response.status_code == 200
    data = response.json()
    assert data["role"] == "participant"
    assert data["team_id"] == "TEAM-RED-BULL-01"

def test_round_visibility_participant():
    # Login as participant
    p_login = client.post("/api/v1/auth/login", json={
        "username": "team-red-bull-01",
        "password": "Password@123",
        "force": True
    }).json()
    token = p_login["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    from app.database import db_manager
    rounds_col = db_manager.get_collection("rounds")
    problems_col = db_manager.get_collection("problem_statements")
    rounds_col.update_one({"round_number": 2}, {"$set": {"status": "LOCKED", "is_active": False, "problem_published": False}})
    problems_col.update_many({"round_number": 2}, {"$set": {"is_published": False}})

    response = client.get("/api/v1/rounds", headers=headers)
    assert response.status_code == 200
    rounds = response.json()
    assert len(rounds) == 3

    # Round 1 exists
    r1 = next(r for r in rounds if r["round_number"] == 1)
    assert r1 is not None

    # Round 2 is LOCKED, so problem statement must be None
    r2 = next(r for r in rounds if r["round_number"] == 2)
    assert r2["problem_statement"] is None

def test_round_3_access_eliminated_team():
    client.post("/api/v1/auth/register-participant", json={
        "team_id": "TEAM-WILLIAMS-06",
        "team_name": "Williams Racing",
        "leader_name": "Alex Albon",
        "email": "alex.a@example.com",
        "password": "Password@123",
        "institution": "GM University",
        "members": ["Member 1"]
    })
    from app.database import db_manager
    teams_col = db_manager.get_collection("teams")
    teams_col.update_one({"team_id": "TEAM-WILLIAMS-06"}, {"$set": {"is_eliminated": True, "is_qualified_r3": False}})

    # Login as eliminated participant
    w_login = client.post("/api/v1/auth/login", json={
        "username": "team-williams-06",
        "password": "Password@123",
        "force": True
    }).json()
    token = w_login["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    response = client.get("/api/v1/rounds", headers=headers)
    assert response.status_code == 200
    rounds = response.json()
    r3 = next(r for r in rounds if r["round_number"] == 3)
    assert r3["user_access"] in ["ELIMINATED", "PENDING_ANNOUNCEMENT"]
    assert r3["problem_statement"] is None

def test_submission_to_locked_round_fails():
    # Participant tries to submit to Round 2 which is LOCKED
    p_login = client.post("/api/v1/auth/login", json={
        "username": "team-red-bull-01",
        "password": "Password@123",
        "force": True
    }).json()
    token = p_login["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    response = client.post(
        "/api/v1/submissions",
        data={"round_number": 2, "github_url": "https://github.com/test"},
        headers=headers
    )
    assert response.status_code == 400
    assert "closed" in response.json()["detail"].lower() or "locked" in response.json()["detail"].lower()

def test_leaderboard_endpoint():
    from app.database import db_manager
    settings_col = db_manager.get_collection("system_settings")
    settings_col.update_one({"key": "leaderboard_config"}, {"$set": {"key": "leaderboard_config", "visibility_mode": "PUBLIC"}})
    response = client.get("/api/v1/leaderboard")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ["LIVE", "FROZEN", "LOCKED"]
    if data["status"] in ["LIVE", "FROZEN"]:
        assert len(data["standings"]) > 0
        assert data["standings"][0]["position"] == 1


def test_portal_separation_and_login_restrictions():
    # 1. Register a test participant
    reg_res = client.post("/api/v1/auth/register-participant", json={
        "team_id": "APEX-GRID-01",
        "team_name": "Apex Grid Racers",
        "leader_name": "Alex Stewart",
        "email": "alex.grid@example.com",
        "password": "Password@123",
        "institution": "GM University",
        "members": ["Member A", "Member B"]
    })
    # Either 200 or 400 if already registered from earlier run
    assert reg_res.status_code in [200, 400]

    # 2. Participant credentials at Admin portal -> REJECTED (403 Forbidden)
    res_part_at_admin = client.post("/api/v1/auth/login", json={
        "username": "apex-grid-01",
        "password": "Password@123",
        "required_role": "admin"
    })
    assert res_part_at_admin.status_code == 403
    assert "Participant credentials cannot be used for Race Director" in res_part_at_admin.json()["detail"]

    # 3. Admin credentials at Participant portal -> REJECTED (403 Forbidden)
    res_admin_at_part = client.post("/api/v1/auth/login", json={
        "username": settings.DEFAULT_ADMIN_USERNAME,
        "password": settings.DEFAULT_ADMIN_PASSWORD,
        "required_role": "participant"
    })
    assert res_admin_at_part.status_code == 403
    assert "Race Director (Admin) credentials cannot be used for Participant login" in res_admin_at_part.json()["detail"]

    # 4. Admin credentials at Admin portal -> ACCEPTED (200 OK)
    res_admin_ok = client.post("/api/v1/auth/login", json={
        "username": settings.DEFAULT_ADMIN_USERNAME,
        "password": settings.DEFAULT_ADMIN_PASSWORD,
        "required_role": "admin"
    })
    assert res_admin_ok.status_code == 200
    assert res_admin_ok.json()["role"] == "admin"

    # 5. Participant credentials at Participant portal -> ACCEPTED (200 OK)
    res_part_ok = client.post("/api/v1/auth/login", json={
        "username": "apex-grid-01",
        "password": "Password@123",
        "required_role": "participant",
        "force": True
    })
    assert res_part_ok.status_code == 200
    assert res_part_ok.json()["role"] == "participant"
    assert res_part_ok.json()["team_id"] == "APEX-GRID-01"


def test_single_device_limit_and_invalidation():
    # Register test participant
    client.post("/api/v1/auth/register-participant", json={
        "team_id": "APEX-GRID-01",
        "team_name": "Apex Grid Racers",
        "leader_name": "Alex Stewart",
        "email": "alex.grid@example.com",
        "password": "Password@123",
        "institution": "GM University",
        "members": ["Member A", "Member B"]
    })

    # Device 1 logs in
    login_dev1 = client.post("/api/v1/auth/login", json={
        "username": "apex-grid-01",
        "password": "Password@123",
        "required_role": "participant",
        "force": True
    })
    assert login_dev1.status_code == 200
    token1 = login_dev1.json()["access_token"]

    # Device 1 can access protected route
    res_dev1_active = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token1}"})
    assert res_dev1_active.status_code == 200

    # Device 2 tries to log in with force=False -> BLOCKED (409 Conflict)
    login_dev2_blocked = client.post("/api/v1/auth/login", json={
        "username": "apex-grid-01",
        "password": "Password@123",
        "required_role": "participant",
        "force": False
    })
    assert login_dev2_blocked.status_code == 409
    assert "already logged in on another device" in login_dev2_blocked.json()["detail"]

    # Device 2 confirms takeover (force=True) -> SUCCESS (200 OK)
    login_dev2_success = client.post("/api/v1/auth/login", json={
        "username": "apex-grid-01",
        "password": "Password@123",
        "required_role": "participant",
        "force": True
    })
    assert login_dev2_success.status_code == 200
    token2 = login_dev2_success.json()["access_token"]

    # Device 2 is active and valid
    res_dev2_active = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token2}"})
    assert res_dev2_active.status_code == 200

    # Device 1 is now INVALIDATED (401 Unauthorized) - Only 1 device valid at a time
    res_dev1_terminated = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token1}"})
    assert res_dev1_terminated.status_code == 401
    assert "terminated because this account was logged into on another device" in res_dev1_terminated.json()["detail"]


def test_admin_remote_logout_and_online_status():
    # 1. Register and login participant
    client.post("/api/v1/auth/register-participant", json={
        "team_id": "TEAM-FERRARI-01",
        "team_name": "Scuderia Ferrari",
        "leader_name": "Charles Leclerc",
        "email": "charles.l@example.com",
        "password": "Password@123",
        "institution": "GM University",
        "members": ["Member 1"]
    })
    login_part = client.post("/api/v1/auth/login", json={
        "username": "team-ferrari-01",
        "password": "Password@123",
        "required_role": "participant",
        "force": True
    })
    assert login_part.status_code == 200
    part_token = login_part.json()["access_token"]

    # 2. Login admin
    login_admin = client.post("/api/v1/auth/login", json={
        "username": settings.DEFAULT_ADMIN_USERNAME,
        "password": settings.DEFAULT_ADMIN_PASSWORD,
        "required_role": "admin"
    })
    assert login_admin.status_code == 200
    admin_token = login_admin.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # 3. Admin gets teams -> Team is online with registration details
    res_teams = client.get("/api/v1/admin/teams", headers=admin_headers)
    assert res_teams.status_code == 200
    all_teams = res_teams.json()
    ferrari = next((t for t in all_teams if t.get("team_id") == "TEAM-FERRARI-01"), None)
    assert ferrari is not None
    assert ferrari["is_online"] is True
    assert ferrari["email"] == "charles.l@example.com"
    assert ferrari["leader_name"] == "Charles Leclerc"
    assert ferrari["registered_at"] != ""

    # 4. Participant can access protected route
    res_me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {part_token}"})
    assert res_me.status_code == 200

    # 5. Admin forces logout of participant
    res_logout = client.post("/api/v1/admin/teams/TEAM-FERRARI-01/logout", headers=admin_headers)
    assert res_logout.status_code == 200
    assert res_logout.json()["is_online"] is False

    # 6. Participant token is now invalidated (401 Unauthorized)
    res_me_after = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {part_token}"})
    assert res_me_after.status_code == 401

    # 7. Admin checks teams again -> Team is now offline
    res_teams_after = client.get("/api/v1/admin/teams", headers=admin_headers)
    ferrari_after = next((t for t in res_teams_after.json() if t.get("team_id") == "TEAM-FERRARI-01"), None)
    assert ferrari_after is not None
    assert ferrari_after["is_online"] is False


def test_round_progression_and_sealed_qualification():
    # 1. Login admin
    login_admin = client.post("/api/v1/auth/login", json={
        "username": settings.DEFAULT_ADMIN_USERNAME,
        "password": settings.DEFAULT_ADMIN_PASSWORD,
        "required_role": "admin"
    })
    admin_token = login_admin.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    # Reset round 3 state and team qualification for idempotency
    rounds_col.update_one({"round_number": 3}, {"$set": {"selection_revealed": False, "results_announced": False, "results_timer_active": False, "status": "LOCKED"}})
    teams_col.update_one({"team_id": "TEAM-RED-BULL-01"}, {"$set": {"is_qualified_r3": False, "is_eliminated": False}})

    # 2. Login participant
    login_part = client.post("/api/v1/auth/login", json={
        "username": "team-red-bull-01",
        "password": "Password@123",
        "required_role": "participant",
        "force": True
    })
    part_token = login_part.json()["access_token"]
    part_headers = {"Authorization": f"Bearer {part_token}"}

    # 3. Close Round 1 -> Round 2 starts automatically
    client.post("/api/v1/admin/rounds/1/open", headers=admin_headers)
    close_r1 = client.post("/api/v1/admin/rounds/1/close", headers=admin_headers)
    assert close_r1.status_code == 200

    overview = client.get("/api/v1/admin/overview", headers=admin_headers).json()
    r2 = next((r for r in overview["rounds"] if r["round_number"] == 2), None)
    assert r2 is not None
    assert r2["status"] == "LIVE"

    # 4. Close Round 2 -> Round 3 does NOT start automatically (stays LOCKED)
    close_r2 = client.post("/api/v1/admin/rounds/2/close", headers=admin_headers)
    assert close_r2.status_code == 200

    overview_after_r2 = client.get("/api/v1/admin/overview", headers=admin_headers).json()
    r3 = next((r for r in overview_after_r2["rounds"] if r["round_number"] == 3), None)
    assert r3 is not None
    assert r3["status"] != "LIVE"

    # 5. Admin qualifies team for Round 3
    qualify_res = client.post("/api/v1/admin/elimination/qualify", headers=admin_headers, json={
        "qualifications": [{"team_id": "TEAM-RED-BULL-01", "qualified": True, "feedback": "Good job"}]
    })
    assert qualify_res.status_code == 200

    # 6. Participant checks Round 3 before timer: status is SEALED / PENDING_ANNOUNCEMENT, is_qualified_r3 is False
    res_part_r3 = client.get("/api/v1/rounds/3", headers=part_headers).json()
    assert res_part_r3["user_access"] == "PENDING_ANNOUNCEMENT"
    assert res_part_r3["selection_status"] in ["SEALED", "PENDING_ANNOUNCEMENT"]

    res_part_me = client.get("/api/v1/auth/me", headers=part_headers).json()
    assert res_part_me.get("team", {}).get("is_qualified_r3") is False

    # 7. Admin commands reveal of Round 3 qualifiers
    announce_res = client.post("/api/v1/admin/rounds/3/results-timer?action=announce_now", headers=admin_headers)
    assert announce_res.status_code == 200

    # 8. Participant checks Round 3 after announcement: now QUALIFIED is displayed
    res_part_r3_after = client.get("/api/v1/rounds/3", headers=part_headers).json()
    assert res_part_r3_after["user_access"] == "QUALIFIED"

    # Reset round 3 back to clean state
    rounds_col.update_one({"round_number": 3}, {"$set": {"selection_revealed": False, "results_announced": False, "results_timer_active": False}})
    teams_col.update_one({"team_id": "TEAM-RED-BULL-01"}, {"$set": {"is_qualified_r3": False, "is_eliminated": False}})


