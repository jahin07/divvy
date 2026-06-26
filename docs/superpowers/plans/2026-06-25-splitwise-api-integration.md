# Splitwise API Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the Divvy bill-splitter import people from a Splitwise account and push computed splits back to Splitwise as real expenses, using a personal API key.

**Architecture:** A backend-proxy design. New `splitwise_client.py` wraps the Splitwise REST API (raw HTTP via `requests`); a pure `build_expense_payload` function converts `compute_split` output into a Splitwise expense payload (with penny-rounding reconciliation). New `/api/splitwise/*` Flask routes expose status/groups/friends/expense to the React app. The frontend gains an "Import from Splitwise" path in the People step and a "Push to Splitwise" button in Results.

**Tech Stack:** Python 3 / Flask (backend), `requests` (HTTP), `pytest` (tests), React 19 + TypeScript + Vite (frontend). Splitwise API v3.0, auth via `Authorization: Bearer <SPLITWISE_API_KEY>`.

**Testing strategy:** Backend logic is covered by automated `pytest` tests (the rounding reconciliation and payload building are the highest-risk code and are pure functions). The frontend has no test runner in this project; frontend tasks are verified manually against the running app, consistent with the existing setup.

---

## File Structure

**Backend (new):**
- `splitwise_client.py` — HTTP wrapper over Splitwise API + `build_expense_payload` pure function + `SplitwiseError`. One responsibility: talk to Splitwise / shape its payloads.
- `tests/test_build_expense_payload.py` — unit tests for the pure payload builder.
- `tests/test_splitwise_client.py` — unit tests for the HTTP wrapper (requests mocked).
- `tests/test_api_splitwise_routes.py` — Flask route tests (client mocked).

**Backend (modified):**
- `app.py` — add `/api/splitwise/status`, `/groups`, `/friends`, `/expense` routes.
- `.gitignore` (create at repo root if absent) — ignore any local env file.

**Frontend (modified):**
- `frontend/src/types.ts` — `Person.splitwiseId`, Splitwise list types.
- `frontend/src/hooks/useSplitwise.ts` (new) — fetch helpers for the new routes.
- `frontend/src/components/StepPeople.tsx` — "Import from Splitwise" UI.
- `frontend/src/components/StepResults.tsx` — "Push to Splitwise" button.
- `frontend/src/App.tsx` — pass `groupId` / Splitwise context through if needed.

**Docs (modified):**
- `CLAUDE.md` — document the env var and the new routes.

---

## Task 1: Backend test + dependency setup

**Files:**
- Create: `tests/__init__.py` (empty)
- Create: `requirements.txt`
- Create: `pytest.ini`

- [ ] **Step 1: Install dependencies into the venv**

Run:
```bash
./venv/bin/pip install requests pytest
```
Expected: successful install of `requests` and `pytest`.

- [ ] **Step 2: Record dependencies**

Create `requirements.txt`:
```
flask
requests
pytest
```

- [ ] **Step 3: Configure pytest**

Create `pytest.ini`:
```ini
[pytest]
testpaths = tests
python_files = test_*.py
```

- [ ] **Step 4: Create the tests package**

Create empty file `tests/__init__.py`.

- [ ] **Step 5: Verify pytest runs (no tests yet)**

Run: `./venv/bin/python -m pytest -q`
Expected: "no tests ran" (exit code 5) — confirms pytest is wired up.

- [ ] **Step 6: Commit**

```bash
git add requirements.txt pytest.ini tests/__init__.py
git commit -m "chore: add pytest + requests and test scaffolding"
```

---

## Task 2: `build_expense_payload` pure function (rounding reconciliation)

This is the highest-risk logic. It converts `compute_split` output into the structured Splitwise expense payload and guarantees `sum(owed) == sum(paid) == cost` to the cent.

**Files:**
- Create: `splitwise_client.py`
- Test: `tests/test_build_expense_payload.py`

- [ ] **Step 1: Write the failing tests**

Create `tests/test_build_expense_payload.py`:
```python
import pytest
from splitwise_client import build_expense_payload


def make_result(breakdown, total_paid, payee):
    return {
        "payee": payee,
        "total_paid": total_paid,
        "breakdown": breakdown,
    }


def test_basic_two_people_payee_pays():
    result = make_result(
        breakdown={
            "Alice": {"pre_tax": 10.0, "tax": 0.0, "tip": 0.0, "total": 10.0},
            "Bob": {"pre_tax": 10.0, "tax": 0.0, "tip": 0.0, "total": 10.0},
        },
        total_paid=20.0,
        payee="Alice",
    )
    payload = build_expense_payload(
        result, payee="Alice", mapping={"Alice": 1, "Bob": 2},
        group_id=None, description="Dinner",
    )
    assert payload["cost"] == "20.00"
    assert payload["description"] == "Dinner"
    assert payload["group_id"] == 0
    users = {u["user_id"]: u for u in payload["users"]}
    assert users[1]["paid_share"] == "20.00"
    assert users[1]["owed_share"] == "10.00"
    assert users[2]["paid_share"] == "0.00"
    assert users[2]["owed_share"] == "10.00"


def test_group_id_passthrough():
    result = make_result(
        breakdown={
            "A": {"pre_tax": 5.0, "tax": 0, "tip": 0, "total": 5.0},
            "B": {"pre_tax": 5.0, "tax": 0, "tip": 0, "total": 5.0},
        },
        total_paid=10.0,
        payee="A",
    )
    payload = build_expense_payload(
        result, payee="A", mapping={"A": 1, "B": 2},
        group_id=42, description="x",
    )
    assert payload["group_id"] == 42


def test_rounding_reconciliation_when_shares_undershoot_cost():
    # 10.00 split 3 ways => 3.33 each, sums to 9.99; one cent must be added.
    result = make_result(
        breakdown={
            "A": {"pre_tax": 3.33, "tax": 0, "tip": 0, "total": 3.33},
            "B": {"pre_tax": 3.33, "tax": 0, "tip": 0, "total": 3.33},
            "C": {"pre_tax": 3.34, "tax": 0, "tip": 0, "total": 3.34},
        },
        total_paid=10.0,
        payee="A",
    )
    payload = build_expense_payload(
        result, payee="A", mapping={"A": 1, "B": 2, "C": 3},
        group_id=None, description="x",
    )
    owed_cents = sum(round(float(u["owed_share"]) * 100) for u in payload["users"])
    paid_cents = sum(round(float(u["paid_share"]) * 100) for u in payload["users"])
    assert owed_cents == 1000
    assert paid_cents == 1000


def test_reconciliation_adjusts_largest_owed_share():
    # Shares sum to 9.98, two cents short of 10.00. The extra goes to the largest owed.
    result = make_result(
        breakdown={
            "A": {"pre_tax": 2.0, "tax": 0, "tip": 0, "total": 2.0},
            "B": {"pre_tax": 7.98, "tax": 0, "tip": 0, "total": 7.98},
        },
        total_paid=10.0,
        payee="A",
    )
    payload = build_expense_payload(
        result, payee="A", mapping={"A": 1, "B": 2},
        group_id=None, description="x",
    )
    users = {u["user_id"]: u for u in payload["users"]}
    assert users[2]["owed_share"] == "8.00"  # 7.98 + 0.02 to the largest
    assert users[1]["owed_share"] == "2.00"


def test_missing_mapping_raises():
    result = make_result(
        breakdown={"A": {"pre_tax": 5, "tax": 0, "tip": 0, "total": 5.0},
                   "B": {"pre_tax": 5, "tax": 0, "tip": 0, "total": 5.0}},
        total_paid=10.0, payee="A",
    )
    with pytest.raises(ValueError):
        build_expense_payload(result, payee="A", mapping={"A": 1},
                              group_id=None, description="x")
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `./venv/bin/python -m pytest tests/test_build_expense_payload.py -v`
Expected: FAIL — `ImportError: cannot import name 'build_expense_payload'`.

- [ ] **Step 3: Implement `build_expense_payload`**

Create `splitwise_client.py`:
```python
"""Client + payload helpers for the Splitwise API.

Pure helpers (build_expense_payload) are separated from HTTP so they can be
unit-tested without network access.
"""


def _to_cents(amount):
    return round(float(amount) * 100)


def _cents_to_str(cents):
    return f"{cents / 100:.2f}"


def build_expense_payload(result, payee, mapping, group_id, description):
    """Convert a compute_split result into a Splitwise expense payload.

    Returns a structured dict:
        {cost, description, group_id, users: [{user_id, paid_share, owed_share}]}

    Guarantees sum(owed) == sum(paid) == cost in integer cents by nudging the
    largest owed share to absorb rounding drift (Splitwise rejects mismatches).
    """
    breakdown = result["breakdown"]
    names = list(breakdown.keys())

    missing = [n for n in names if n not in mapping]
    if missing:
        raise ValueError(f"Missing Splitwise id mapping for: {missing}")
    if payee not in mapping:
        raise ValueError(f"Missing Splitwise id mapping for payee: {payee}")

    cost_cents = _to_cents(result["total_paid"])

    owed = {n: _to_cents(breakdown[n]["total"]) for n in names}

    # Reconcile rounding: push leftover cents onto the largest owed share.
    drift = cost_cents - sum(owed.values())
    if drift != 0:
        largest = max(names, key=lambda n: owed[n])
        owed[largest] += drift

    users = []
    for n in names:
        users.append({
            "user_id": mapping[n],
            "paid_share": _cents_to_str(cost_cents if n == payee else 0),
            "owed_share": _cents_to_str(owed[n]),
        })

    return {
        "cost": _cents_to_str(cost_cents),
        "description": description,
        "group_id": group_id if group_id is not None else 0,
        "users": users,
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `./venv/bin/python -m pytest tests/test_build_expense_payload.py -v`
Expected: PASS (5 passed).

- [ ] **Step 5: Commit**

```bash
git add splitwise_client.py tests/test_build_expense_payload.py
git commit -m "feat: add build_expense_payload with rounding reconciliation"
```

---

## Task 3: Splitwise HTTP client

**Files:**
- Modify: `splitwise_client.py`
- Test: `tests/test_splitwise_client.py`

- [ ] **Step 1: Write the failing tests**

Create `tests/test_splitwise_client.py`:
```python
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
        return FakeResponse(200, {"expenses": [{"id": 999}], "errors": {}})

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
    # Flattened form encoding for Splitwise:
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


def test_missing_key_raises(monkeypatch):
    monkeypatch.delenv("SPLITWISE_API_KEY", raising=False)
    with pytest.raises(sw.SplitwiseError):
        sw.get_current_user()
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `./venv/bin/python -m pytest tests/test_splitwise_client.py -v`
Expected: FAIL — `AttributeError`/`ImportError` (no `requests`, `SplitwiseError`, or functions yet).

- [ ] **Step 3: Implement the client**

Add to `splitwise_client.py` (top of file, above the pure helpers):
```python
import os
import requests

BASE_URL = "https://secure.splitwise.com/api/v3.0"


class SplitwiseError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.message = message
        self.status = status


def _headers():
    key = os.environ.get("SPLITWISE_API_KEY")
    if not key:
        raise SplitwiseError("Splitwise API key not configured", status=400)
    return {"Authorization": f"Bearer {key}"}


def _member_name(m):
    parts = [m.get("first_name") or "", m.get("last_name") or ""]
    return " ".join(p for p in parts if p).strip()
```

Add to the bottom of `splitwise_client.py` (after `build_expense_payload`):
```python
def get_current_user():
    resp = requests.get(f"{BASE_URL}/get_current_user", headers=_headers())
    if resp.status_code != 200:
        raise SplitwiseError("Splitwise auth failed", status=resp.status_code)
    return resp.json()["user"]


def get_groups():
    resp = requests.get(f"{BASE_URL}/get_groups", headers=_headers())
    if resp.status_code != 200:
        raise SplitwiseError("Failed to fetch groups", status=resp.status_code)
    groups = []
    for g in resp.json()["groups"]:
        groups.append({
            "id": g["id"],
            "name": g["name"],
            "members": [{"id": m["id"], "name": _member_name(m)}
                        for m in g.get("members", [])],
        })
    return groups


def get_friends():
    resp = requests.get(f"{BASE_URL}/get_friends", headers=_headers())
    if resp.status_code != 200:
        raise SplitwiseError("Failed to fetch friends", status=resp.status_code)
    return [{"id": f["id"], "name": _member_name(f)}
            for f in resp.json()["friends"]]


def create_expense(payload):
    data = {
        "cost": payload["cost"],
        "description": payload["description"],
        "group_id": payload["group_id"],
    }
    for i, u in enumerate(payload["users"]):
        data[f"users__{i}__user_id"] = u["user_id"]
        data[f"users__{i}__paid_share"] = u["paid_share"]
        data[f"users__{i}__owed_share"] = u["owed_share"]

    resp = requests.post(f"{BASE_URL}/create_expense",
                         headers=_headers(), data=data)
    if resp.status_code != 200:
        raise SplitwiseError("Splitwise rejected the expense",
                             status=resp.status_code)
    body = resp.json()
    if body.get("errors"):
        raise SplitwiseError(str(body["errors"]), status=400)
    return body["expenses"][0]["id"]
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `./venv/bin/python -m pytest tests/test_splitwise_client.py -v`
Expected: PASS (6 passed).

- [ ] **Step 5: Commit**

```bash
git add splitwise_client.py tests/test_splitwise_client.py
git commit -m "feat: add Splitwise HTTP client (current user, groups, friends, create expense)"
```

---

## Task 4: Flask routes

**Files:**
- Modify: `app.py`
- Test: `tests/test_api_splitwise_routes.py`

- [ ] **Step 1: Write the failing tests**

Create `tests/test_api_splitwise_routes.py`:
```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `./venv/bin/python -m pytest tests/test_api_splitwise_routes.py -v`
Expected: FAIL — 404s, because the routes don't exist yet.

- [ ] **Step 3: Implement the routes**

In `app.py`, add the import near the top (alongside `from bill_split import compute_split`):
```python
import splitwise_client as sw
from splitwise_client import build_expense_payload, SplitwiseError
```

Add these routes in `app.py` (before the catch-all `serve` route, since `serve` matches `/<path:path>`):
```python
@app.route('/api/splitwise/status', methods=['GET'])
def splitwise_status():
    try:
        user = sw.get_current_user()
        return jsonify({'configured': True, 'user': user})
    except SplitwiseError:
        return jsonify({'configured': False})


@app.route('/api/splitwise/groups', methods=['GET'])
def splitwise_groups():
    try:
        return jsonify({'groups': sw.get_groups()})
    except SplitwiseError as e:
        return jsonify({'error': e.message}), e.status


@app.route('/api/splitwise/friends', methods=['GET'])
def splitwise_friends():
    try:
        return jsonify({'friends': sw.get_friends()})
    except SplitwiseError as e:
        return jsonify({'error': e.message}), e.status


@app.route('/api/splitwise/expense', methods=['POST'])
def splitwise_expense():
    data = request.get_json(silent=True) or {}
    try:
        payload = build_expense_payload(
            result=data['result'],
            payee=data['payee'],
            mapping=data['mapping'],
            group_id=data.get('groupId'),
            description=data.get('description', 'Divvy split'),
        )
    except (KeyError, ValueError) as e:
        return jsonify({'error': f'Invalid request: {e}'}), 400
    try:
        expense_id = sw.create_expense(payload)
        return jsonify({'ok': True, 'expenseId': expense_id})
    except SplitwiseError as e:
        return jsonify({'error': e.message}), e.status
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `./venv/bin/python -m pytest tests/test_api_splitwise_routes.py -v`
Expected: PASS (6 passed).

- [ ] **Step 5: Run the full backend suite**

Run: `./venv/bin/python -m pytest -q`
Expected: PASS (17 passed).

- [ ] **Step 6: Commit**

```bash
git add app.py tests/test_api_splitwise_routes.py
git commit -m "feat: add /api/splitwise routes (status, groups, friends, expense)"
```

---

## Task 5: Frontend types + `useSplitwise` hook

No automated tests (no frontend runner); verified by compilation and later manual testing.

**Files:**
- Modify: `frontend/src/types.ts`
- Create: `frontend/src/hooks/useSplitwise.ts`

- [ ] **Step 1: Extend types**

In `frontend/src/types.ts`, change the `Person` interface and add Splitwise types:
```typescript
export interface Person {
  name: string
  share: number
  splitwiseId?: number
}

export interface SplitwiseUser {
  id: number
  name: string
}

export interface SplitwiseGroup {
  id: number
  name: string
  members: SplitwiseUser[]
}

export interface SplitwiseStatus {
  configured: boolean
  user?: { id: number; first_name?: string }
}
```

- [ ] **Step 2: Create the hook**

Create `frontend/src/hooks/useSplitwise.ts`:
```typescript
import { useEffect, useState } from 'react'
import type {
  SplitwiseStatus,
  SplitwiseGroup,
  SplitwiseUser,
  CalculationResult,
} from '../types'

export function useSplitwise() {
  const [status, setStatus] = useState<SplitwiseStatus>({ configured: false })

  useEffect(() => {
    fetch('/api/splitwise/status')
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ configured: false }))
  }, [])

  async function getGroups(): Promise<SplitwiseGroup[]> {
    const r = await fetch('/api/splitwise/groups')
    const j = await r.json()
    if (!r.ok) throw new Error(j.error || 'Failed to load groups')
    return j.groups
  }

  async function getFriends(): Promise<SplitwiseUser[]> {
    const r = await fetch('/api/splitwise/friends')
    const j = await r.json()
    if (!r.ok) throw new Error(j.error || 'Failed to load friends')
    return j.friends
  }

  async function pushExpense(args: {
    result: CalculationResult
    payee: string
    mapping: Record<string, number>
    groupId: number | null
    description: string
  }): Promise<{ expenseId?: number; error?: string }> {
    const r = await fetch('/api/splitwise/expense', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    })
    const j = await r.json()
    if (!r.ok) return { error: j.error || 'Failed to push expense' }
    return { expenseId: j.expenseId }
  }

  return { status, getGroups, getFriends, pushExpense }
}
```

- [ ] **Step 3: Verify it compiles**

Run: `cd frontend && npx tsc -b`
Expected: no type errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types.ts frontend/src/hooks/useSplitwise.ts
git commit -m "feat: add Splitwise frontend types and useSplitwise hook"
```

---

## Task 6: "Import from Splitwise" in the People step

**Files:**
- Modify: `frontend/src/components/StepPeople.tsx`

- [ ] **Step 1: Read the current component**

Run: `cat frontend/src/components/StepPeople.tsx`
Note its props (`people`, `onChange`, `error`, `onNext`) and the existing layout/markup conventions so the new UI matches.

- [ ] **Step 2: Add the import UI**

In `StepPeople.tsx`, use `useSplitwise()` to read `status`. When `status.configured` is true, render an "Import from Splitwise" control above the manual list:
- A toggle/segmented control to pick **Group** or **Friends**.
- For **Group**: a `<select>` populated from `getGroups()`; on selection, call `onChange` with the group's members mapped to `Person` objects (`{ name, share: 1, splitwiseId: member.id }`) and lift the chosen `groupId` to `App` (see Step 3).
- For **Friends**: a multi-select list from `getFriends()`; selected friends become `Person` objects with `splitwiseId`; `groupId` stays `null`.

Match existing markup: reuse the `ui/` primitives (`Button`, `Input`, `Card`, `ChipCheckbox`, `RadioCard`) already in `frontend/src/components/ui/`. Show fetch errors via the existing `ErrorMessage` component.

- [ ] **Step 3: Lift `groupId` to App**

In `frontend/src/App.tsx`, add `const [splitwiseGroupId, setSplitwiseGroupId] = useState<number | null>(null)` and pass a setter into `StepPeople` so a group import records its `groupId`. (Friends import or manual entry sets it back to `null`.) This `splitwiseGroupId` is consumed by the Results push in Task 7.

- [ ] **Step 4: Verify it compiles and renders**

Run: `cd frontend && npx tsc -b`
Expected: no type errors.

Then with the backend running (`SPLITWISE_API_KEY` set) and `npm run dev`, load step 1: when a key is configured, the import control appears; picking a group/friends fills the People list with names. When no key is set, the control is hidden and manual entry is unchanged.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/StepPeople.tsx frontend/src/App.tsx
git commit -m "feat: import people from Splitwise groups/friends in People step"
```

---

## Task 7: "Push to Splitwise" in the Results step

**Files:**
- Modify: `frontend/src/components/StepResults.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Read the current component**

Run: `cat frontend/src/components/StepResults.tsx`
Note its props (`results`, `error`, `loading`, `onBack`, `onReset`) and layout.

- [ ] **Step 2: Add the push button**

In `StepResults.tsx`:
- Accept new props: `people: Person[]`, `payee: string`, `groupId: number | null`.
- Build `mapping` from `people`: `Object.fromEntries(people.filter(p => p.splitwiseId != null).map(p => [p.name, p.splitwiseId!]))`.
- The "Push to Splitwise" button is **enabled only** when `results` exists and every person has a `splitwiseId` (i.e. `people.every(p => p.splitwiseId != null)`); otherwise render it disabled with a hint ("Import people from Splitwise to enable").
- On click, call `pushExpense({ result: results, payee, mapping, groupId, description })` from `useSplitwise()`, with `description` defaulting to ``Divvy split — ${new Date().toLocaleDateString()}``.
- Show a success state ("Added to Splitwise ✓") with the returned `expenseId`, or the error via `ErrorMessage`. Use a local `useState` for the push's loading/success/error.

- [ ] **Step 3: Pass props from App**

In `frontend/src/App.tsx`, pass `people={state.people}`, `payee={state.payee!}`, and `groupId={splitwiseGroupId}` into `<StepResults />`.

- [ ] **Step 4: Verify it compiles**

Run: `cd frontend && npx tsc -b`
Expected: no type errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/StepResults.tsx frontend/src/App.tsx
git commit -m "feat: push computed split to Splitwise from Results step"
```

---

## Task 8: Docs + gitignore + end-to-end manual verification

**Files:**
- Modify: `CLAUDE.md`
- Create/Modify: `.gitignore`

- [ ] **Step 1: Ignore local env**

Create or update `.gitignore` at repo root to include:
```
.env
__pycache__/
```

- [ ] **Step 2: Document the integration in CLAUDE.md**

In `CLAUDE.md`, under the `app.py` section, document the new routes (`/api/splitwise/status`, `/groups`, `/friends`, `/expense`) and `splitwise_client.py`. Under "Running the App", note that Splitwise features require `export SPLITWISE_API_KEY=<key>` before `python app.py`, and that without it the app runs normally with Splitwise features hidden.

- [ ] **Step 3: Full backend suite**

Run: `./venv/bin/python -m pytest -q`
Expected: PASS (all tests green).

- [ ] **Step 4: End-to-end manual smoke test**

With `export SPLITWISE_API_KEY=<key>` set:
```bash
./venv/bin/python app.py        # terminal 1
cd frontend && npm run dev      # terminal 2
```
In the browser: import a group, run a split through all 5 steps, click "Push to Splitwise", then confirm the expense appears in your Splitwise account with shares that sum correctly. Also confirm: with the key unset, the app still works as a purely local splitter and the Splitwise controls are hidden.

- [ ] **Step 5: Commit**

```bash
git add CLAUDE.md .gitignore
git commit -m "docs: document Splitwise integration and env var"
```

---

## Self-Review Notes

- **Spec coverage:** Import (groups + friends) → Tasks 3, 6. Push expense → Tasks 2, 3, 4, 7. Personal-key auth via env → Tasks 3, 8. Backend proxy → Task 4. Rounding reconciliation → Task 2. Additive/optional (hidden without key) → Tasks 4 (`/status`), 6, 7. Testing strategy → Tasks 2–4 automated, 5–7 manual. All spec sections map to tasks.
- **Type consistency:** `build_expense_payload(result, payee, mapping, group_id, description)` signature is identical in Tasks 2 and 4. `Person.splitwiseId`, `SplitwiseGroup`, `SplitwiseUser`, `SplitwiseStatus` defined in Task 5 and consumed consistently in Tasks 6–7. `pushExpense` argument shape matches the `/api/splitwise/expense` body in Task 4.
- **No placeholders:** Backend tasks contain complete code. Frontend tasks (5) give full code; tasks 6–7 give precise prop contracts and behavior because they adapt to existing component markup that must be read first (Step 1 of each) rather than rewritten blind.
