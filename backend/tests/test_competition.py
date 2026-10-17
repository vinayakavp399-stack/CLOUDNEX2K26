import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.config import settings

client = TestClient(app)

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "GREEN_FLAG"

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
    response = client.post("/api/v1/auth/login", json={
        "username": "team-red-bull-01",
        "password": "Password@123"
    })
    assert response.status_code == 200
    data = response.json()
    assert data["role"] == "participant"
    assert data["team_id"] == "TEAM-RED-BULL-01"

def test_round_visibility_participant():
    # Login as participant
    p_login = client.post("/api/v1/auth/login", json={
        "username": "team-red-bull-01",
        "password": "Password@123"
    }).json()
    token = p_login["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    response = client.get("/api/v1/rounds", headers=headers)
    assert response.status_code == 200
    rounds = response.json()
    assert len(rounds) == 3

    # Round 1 is LIVE, so problem statement should be visible
    r1 = next(r for r in rounds if r["round_number"] == 1)
    assert r1["problem_statement"] is not None
    assert "Global F1 Telemetry" in r1["problem_statement"]["title"]

    # Round 2 is LOCKED, so problem statement must be None
    r2 = next(r for r in rounds if r["round_number"] == 2)
    assert r2["problem_statement"] is None

def test_round_3_access_eliminated_team():
    # Login as eliminated participant
    w_login = client.post("/api/v1/auth/login", json={
        "username": "team-williams-06",
        "password": "Password@123"
    }).json()
    token = w_login["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    response = client.get("/api/v1/rounds", headers=headers)
    assert response.status_code == 200
    rounds = response.json()
    r3 = next(r for r in rounds if r["round_number"] == 3)
    assert r3["user_access"] == "ELIMINATED"
    assert r3["problem_statement"] is None

def test_submission_to_locked_round_fails():
    # Participant tries to submit to Round 2 which is LOCKED
    p_login = client.post("/api/v1/auth/login", json={
        "username": "team-red-bull-01",
        "password": "Password@123"
    }).json()
    token = p_login["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    response = client.post(
        "/api/v1/submissions",
        data={"round_number": 2, "github_url": "https://github.com/test"},
        headers=headers
    )
    assert response.status_code == 400
    assert "LOCKED" in response.json()["detail"]

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
