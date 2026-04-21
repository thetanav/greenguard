from pathlib import Path

import sqlmodel
from fastapi.testclient import TestClient

import server


def make_client(tmp_path: Path) -> TestClient:
    db_path = tmp_path / "test.db"
    test_engine = sqlmodel.create_engine(f"sqlite:///{db_path}", echo=False)

    server.engine = test_engine
    sqlmodel.SQLModel.metadata.create_all(test_engine)

    return TestClient(server.app)


def test_rest_routes_work(tmp_path):
    client = make_client(tmp_path)

    health_response = client.get("/health")
    assert health_response.status_code == 200
    assert health_response.json() == {"status": "ok"}

    root_response = client.get("/")
    assert root_response.status_code == 200
    assert root_response.json()["name"] == server.settings.app_name
    assert root_response.json()["version"] == server.settings.app_version

    register_response = client.post(
        "/api/auth/register",
        json={"email": "tester@example.com", "password": "secret123", "name": "Tester"},
    )
    assert register_response.status_code == 200

    token = register_response.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    me_response = client.get("/api/auth/me", headers=headers)
    assert me_response.status_code == 200
    assert me_response.json()["email"] == "tester@example.com"

    history_response = client.get("/api/history", headers=headers)
    assert history_response.status_code == 200
    assert history_response.json() == []
