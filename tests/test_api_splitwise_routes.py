import pytest
import app as app_module
import splitwise_client as sw


@pytest.fixture
def client():
    app_module.app.config["TESTING"] = True
    return app_module.app.test_client()


def test_status_configured(client, monkeypatch):
    monkeypatch.setattr(sw, "get_current_user", lambda: {"id": 7, "first_name": "Me"})
    resp = client.get("/api/splitwise/status")
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["configured"] is True
    assert body["user"]["id"] == 7


def test_status_not_configured(client, monkeypatch):
    def boom():
        raise sw.SplitwiseError("Splitwise API key not configured", status=400)
    monkeypatch.setattr(sw, "get_current_user", boom)
    resp = client.get("/api/splitwise/status")
    assert resp.status_code == 200
    assert resp.get_json()["configured"] is False


def test_groups_passthrough(client, monkeypatch):
    monkeypatch.setattr(sw, "get_groups",
                        lambda: [{"id": 1, "name": "Trip", "members": []}])
    resp = client.get("/api/splitwise/groups")
    assert resp.status_code == 200
    assert resp.get_json()["groups"][0]["name"] == "Trip"


def test_friends_passthrough(client, monkeypatch):
    monkeypatch.setattr(sw, "get_friends",
                        lambda: [{"id": 20, "name": "Cara"}])
    resp = client.get("/api/splitwise/friends")
    assert resp.status_code == 200
    assert resp.get_json()["friends"][0]["name"] == "Cara"


def test_expense_happy_path(client, monkeypatch):
    captured = {}

    def fake_create(payload):
        captured["payload"] = payload
        return 999

    monkeypatch.setattr(sw, "create_expense", fake_create)
    body = {
        "result": {
            "payee": "Alice", "total_paid": 20.0,
            "breakdown": {
                "Alice": {"pre_tax": 10, "tax": 0, "tip": 0, "total": 10.0},
                "Bob": {"pre_tax": 10, "tax": 0, "tip": 0, "total": 10.0},
            },
        },
        "payee": "Alice",
        "mapping": {"Alice": 1, "Bob": 2},
        "groupId": None,
        "description": "Dinner",
    }
    resp = client.post("/api/splitwise/expense", json=body)
    assert resp.status_code == 200
    assert resp.get_json()["expenseId"] == 999
    assert captured["payload"]["cost"] == "20.00"


def test_expense_client_error(client, monkeypatch):
    def boom(payload):
        raise sw.SplitwiseError("nope", status=400)
    monkeypatch.setattr(sw, "create_expense", boom)
    body = {
        "result": {"payee": "A", "total_paid": 10.0,
                   "breakdown": {"A": {"pre_tax": 5, "tax": 0, "tip": 0, "total": 5.0},
                                 "B": {"pre_tax": 5, "tax": 0, "tip": 0, "total": 5.0}}},
        "payee": "A", "mapping": {"A": 1, "B": 2},
        "groupId": None, "description": "x",
    }
    resp = client.post("/api/splitwise/expense", json=body)
    assert resp.status_code == 400
    assert "error" in resp.get_json()


def test_expense_missing_fields_returns_400(client):
    resp = client.post("/api/splitwise/expense", json={})
    assert resp.status_code == 400
    assert "error" in resp.get_json()


def test_expense_non_dict_result_returns_400(client):
    resp = client.post("/api/splitwise/expense",
                       json={"result": "oops", "payee": "A",
                             "mapping": {"A": 1}, "groupId": None})
    assert resp.status_code == 400
    assert "error" in resp.get_json()


def test_groups_error_passthrough(client, monkeypatch):
    def boom():
        raise sw.SplitwiseError("down", status=502)
    monkeypatch.setattr(sw, "get_groups", boom)
    resp = client.get("/api/splitwise/groups")
    assert resp.status_code == 502
    assert "error" in resp.get_json()
