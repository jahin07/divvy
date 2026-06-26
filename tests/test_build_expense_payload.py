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
    # 10.00 split 3 ways with each person getting 3.33 sums to 9.99 — one cent
    # short of the total.  The reconciliation branch must add one cent to the
    # largest owed share so the totals balance.
    result = make_result(
        breakdown={
            "A": {"pre_tax": 3.33, "tax": 0, "tip": 0, "total": 3.33},
            "B": {"pre_tax": 3.33, "tax": 0, "tip": 0, "total": 3.33},
            "C": {"pre_tax": 3.33, "tax": 0, "tip": 0, "total": 3.33},
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
    # Confirm the reconciliation actually ran: exactly one share was bumped to
    # 3.34 while the other two remain at 3.33.
    owed_shares = sorted(u["owed_share"] for u in payload["users"])
    assert owed_shares == ["3.33", "3.33", "3.34"]


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
