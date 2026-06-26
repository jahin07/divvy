"""Client + payload helpers for the Splitwise API.

Pure helpers (build_expense_payload) are separated from HTTP so they can be
unit-tested without network access.
"""

from typing import Optional


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
