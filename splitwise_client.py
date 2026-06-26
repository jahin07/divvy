"""Client + payload helpers for the Splitwise API.

Pure helpers (build_expense_payload) are separated from HTTP so they can be
unit-tested without network access.
"""

import os
import requests
from typing import Optional

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


def _to_cents(amount: float) -> int:
    return round(float(amount) * 100)


def _cents_to_str(cents: int) -> str:
    return f"{cents / 100:.2f}"


def build_expense_payload(result: dict, payee: str, mapping: dict, group_id: Optional[int], description: str) -> dict:
    """Convert a compute_split result into a Splitwise expense payload.

    Returns a structured dict:
        {cost, description, group_id, users: [{user_id, paid_share, owed_share}]}

    Guarantees sum(owed) == sum(paid) == cost in integer cents by nudging the
    largest owed share to absorb rounding drift (Splitwise rejects mismatches).
    """
    breakdown = result["breakdown"]
    names = list(breakdown.keys())

    if payee not in breakdown:
        raise ValueError(f"Payee '{payee}' is not in the breakdown")

    missing = [n for n in names if n not in mapping]
    if missing:
        raise ValueError(f"Missing Splitwise id mapping for: {missing}")

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
