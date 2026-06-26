import pytest
import splitwise_client as sw


class FakeResponse:
    def __init__(self, status_code, json_data):
        self.status_code = status_code
        self._json = json_data

    def json(self):
        return self._json


@pytest.fixture(autouse=True)
def set_key(monkeypatch):
    monkeypatch.setenv("SPLITWISE_API_KEY", "test-key")


def test_get_current_user(monkeypatch):
    captured = {}

    def fake_get(url, headers=None, params=None):
        captured["url"] = url
        captured["headers"] = headers
        return FakeResponse(200, {"user": {"id": 7, "first_name": "Me"}})

    monkeypatch.setattr(sw.requests, "get", fake_get)
    user = sw.get_current_user()
    assert user["id"] == 7
    assert captured["url"].endswith("/get_current_user")
    assert captured["headers"]["Authorization"] == "Bearer test-key"


def test_get_groups_maps_members(monkeypatch):
    payload = {"groups": [
        {"id": 1, "name": "Trip", "members": [
            {"id": 10, "first_name": "Al", "last_name": "Ice"},
            {"id": 11, "first_name": "Bob", "last_name": None},
        ]},
    ]}
    monkeypatch.setattr(sw.requests, "get",
                        lambda *a, **k: FakeResponse(200, payload))
    groups = sw.get_groups()
    assert groups == [
        {"id": 1, "name": "Trip", "members": [
            {"id": 10, "name": "Al Ice"},
            {"id": 11, "name": "Bob"},
        ]},
    ]


def test_get_friends_maps_names(monkeypatch):
    payload = {"friends": [
        {"id": 20, "first_name": "Cara", "last_name": "Mel"},
    ]}
    monkeypatch.setattr(sw.requests, "get",
                        lambda *a, **k: FakeResponse(200, payload))
    assert sw.get_friends() == [{"id": 20, "name": "Cara Mel"}]


def test_create_expense_success(monkeypatch):
    captured = {}

    def fake_post(url, headers=None, data=None):
        captured["url"] = url
        captured["data"] = data
        return FakeResponse(200, {"expenses": [{"id": 999}], "errors": []})

    monkeypatch.setattr(sw.requests, "post", fake_post)
    payload = {
        "cost": "20.00", "description": "x", "group_id": 0,
        "users": [
            {"user_id": 1, "paid_share": "20.00", "owed_share": "10.00"},
            {"user_id": 2, "paid_share": "0.00", "owed_share": "10.00"},
        ],
    }
    expense_id = sw.create_expense(payload)
    assert expense_id == 999
    assert captured["data"]["cost"] == "20.00"
    assert captured["data"]["users__0__user_id"] == 1
    assert captured["data"]["users__0__owed_share"] == "10.00"
    assert captured["data"]["users__1__user_id"] == 2


def test_create_expense_surfaces_errors(monkeypatch):
    monkeypatch.setattr(
        sw.requests, "post",
        lambda *a, **k: FakeResponse(200, {"expenses": [], "errors": {"base": ["bad"]}}),
    )
    with pytest.raises(sw.SplitwiseError):
        sw.create_expense({"cost": "1.00", "description": "x",
                           "group_id": 0, "users": []})


def test_create_expense_empty_expenses_raises(monkeypatch):
    monkeypatch.setattr(
        sw.requests, "post",
        lambda *a, **k: FakeResponse(200, {"expenses": [], "errors": {}}),
    )
    with pytest.raises(sw.SplitwiseError):
        sw.create_expense({"cost": "1.00", "description": "x",
                           "group_id": 0, "users": []})


def test_missing_key_raises(monkeypatch):
    monkeypatch.delenv("SPLITWISE_API_KEY", raising=False)
    with pytest.raises(sw.SplitwiseError):
        sw.get_current_user()
