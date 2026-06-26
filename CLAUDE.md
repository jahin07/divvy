# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Divvy** — a bill-splitting app for splitting bills among multiple people. Supports
weighted share counts (e.g., someone paying 2x), partial item participation (an item
shared by only some people), and proportional tax/tip distribution.

The same calculation core powers two front ends:

- A **web UI** (React + Flask) — the primary, full-featured interface.
- A **terminal CLI** — a standalone interactive script.

## Architecture

The split logic lives in **`bill_split.py`** and is shared by both the CLI and the web
backend. The web layers wrap that same pure function — no math is duplicated.

### `bill_split.py` — calculation core + CLI

- **`Item` (TypedDict)** — a line item: `name`, `cost`, and `participants` (either
  `"all"` or a list of names).
- **`compute_split(shares, items, payee, tax, tip) -> dict`** — the pure calculation
  function (no I/O). Returns a results dict: `payee`, `total_paid`, `payee_own_share`,
  `net_advanced`, per-person `breakdown` (`pre_tax`/`tax`/`tip`/`total`), and `debts`
  (what each non-payee owes the payee). This is what both the CLI and the Flask API call.
- **`calculate_split(...)`** — CLI presenter that calls `compute_split` and prints totals.
- **`main()`** — interactive terminal CLI that collects inputs and calls `calculate_split`.
- **`prompt_float(prompt)`** — CLI input helper with a validation loop.

### `app.py` — Flask backend (port 5001)

- **`POST /api/calculate`** — accepts JSON `{ shares, items, payee, tax, tip }`, validates
  it (≥2 people, payee in people, ≥1 item, non-negative costs/tax/tip, known participants,
  non-zero total shares), then calls `compute_split` and returns the result dict as JSON.
- **`GET /api/splitwise/status`** — `{ configured, user? }`. Reports whether a Splitwise
  API key is set (drives whether the UI shows Splitwise features); never errors on a
  missing key.
- **`GET /api/splitwise/groups`** / **`GET /api/splitwise/friends`** — the user's Splitwise
  groups (with members) / friends, each carrying a real Splitwise `user_id`.
- **`POST /api/splitwise/expense`** — body `{ result, payee, mapping, groupId, description }`;
  converts a `compute_split` result into a Splitwise expense (via `build_expense_payload`)
  and creates it. Returns `{ ok, expenseId }`.
- **`GET /<path>`** — serves the built frontend from `static/dist` (SPA fallback to
  `index.html`).
- Run with `python app.py` (uses `debug=True`).

### `splitwise_client.py` — Splitwise integration core

Backend-proxy wrapper over the Splitwise REST API (`https://secure.splitwise.com/api/v3.0`,
auth via `Authorization: Bearer <SPLITWISE_API_KEY>`). The Flask routes call this; the
frontend never sees the key.

- **`build_expense_payload(result, payee, mapping, group_id, description)`** — pure function
  converting a `compute_split` result into a Splitwise expense payload. Reconciles
  penny-rounding so `sum(owed) == sum(paid) == cost` to the cent (Splitwise rejects
  mismatches). Unit-tested in isolation.
- **`get_current_user()` / `get_groups()` / `get_friends()` / `create_expense(payload)`** —
  thin HTTP calls (via `requests`). Raise `SplitwiseError` (carrying `.message`/`.status`)
  on a missing key or upstream failure.

### `frontend/` — React web UI

Vite + React 19 + TypeScript + Tailwind CSS v4 + Framer Motion. A 5-step wizard:
**People → Payee → Items → Tax/Tip → Results**.

- `src/App.tsx` — wizard orchestration and per-step validation gating (`goToStep`).
- `src/hooks/useWizard.ts` — `useReducer` state machine for the wizard (`WizardState`/`WizardAction`).
- `src/hooks/useCalculate.ts` — POSTs to `/api/calculate` and returns `{ data | error }`.
- `src/hooks/useSplitwise.ts` — reads `/api/splitwise/status` and exposes
  `getGroups`/`getFriends`/`pushExpense`. Splitwise UI only appears when `status.configured`.
- `src/components/Step*.tsx` — one component per wizard step; `src/components/ui/` — shared
  primitives. **StepPeople** can import people from a Splitwise group or friends list (each
  `Person` then carries a `splitwiseId`); **StepResults** can push the computed split to
  Splitwise (button enabled only when every participant has a `splitwiseId`).
- `src/types.ts` — shared TS types (mirror the backend's request/response shapes).
- `vite.config.ts` — dev server on `0.0.0.0` over **https** (self-signed via
  `@vitejs/plugin-basic-ssl`), proxies `/api` → `http://localhost:5001`, and builds to
  `../static/dist`.

## Running the App

### Web UI (primary)

Run the backend and the frontend dev server together:

```bash
# Terminal 1 — Flask API on :5001
python app.py

# Terminal 2 — Vite dev server (proxies /api to the backend)
cd frontend && npm run dev
```

Open the URL Vite prints (note: served over **https**, so accept the self-signed cert).

**Splitwise features (optional):** export a personal Splitwise API key before starting the
backend so import/push light up:

```bash
export SPLITWISE_API_KEY=<key>   # from secure.splitwise.com/apps
python app.py
```

Without the key the app runs as a normal local splitter and all Splitwise controls stay
hidden. The key is read only by the backend (never sent to the browser) and must not be
committed — `.env` is gitignored.

To run a single-process production-style build instead, build the frontend and let Flask
serve it:

```bash
cd frontend && npm run build   # outputs to ../static/dist
python app.py                  # serves the built UI at http://localhost:5001
```

### Terminal CLI

```bash
python bill_split.py
```

The CLI has no external dependencies (standard library only). The web stack adds Flask and
`requests` (see `venv/` / `requirements.txt`) and the frontend's npm dependencies.

## Tests

Backend logic is covered by `pytest` (`./venv/bin/python -m pytest`) under `tests/` —
the payload builder, the Splitwise HTTP client (with the network mocked), and the Flask
routes. The frontend has no test runner; it's verified via `cd frontend && npx tsc -b`
and manual use.

## Key Design Detail

When an item is shared by `"all"`, its cost is weighted by each person's share count.
When shared by specific names, the cost splits **equally** among those people (ignoring
share counts). Tax and tip are then allocated to each person in proportion to their
pre-tax subtotal.
