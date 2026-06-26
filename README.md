# Divvy

Split bills among people — fairly. Divvy handles weighted shares (someone paying a
larger portion), per-item participation (an item shared by only some people), and
proportional tax/tip distribution. It runs as a polished web app and, optionally,
connects to your **Splitwise** account to import people and push the computed split as a
real expense.

<p align="center"><em>People → Payee → Items → Tax/Tip → Results</em></p>

## Features

- **Fair splitting** — items shared by *everyone* are weighted by each person's share
  count; items shared by *specific* people split equally among them. Tax and tip are
  allocated in proportion to each person's pre-tax subtotal.
- **5-step wizard** — a guided flow with per-step validation: People → Payee → Items →
  Tax/Tip → Results.
- **Splitwise integration (optional)**
  - **Import** people from a Splitwise group or your friends list (with searchable
    pickers; you're included automatically in friends-based splits).
  - **Push** the computed split back to Splitwise as a real expense, with an editable
    title. Penny-rounding is reconciled so the shares always sum exactly to the total.
- **Terminal CLI** — the same calculation core is available as a standalone interactive
  script, with no external dependencies.

## How Divvy differs from Splitwise

Splitwise is a **ledger** — it tracks who owes whom over time across many expenses,
groups, and settle-ups. Divvy is a **calculator** for a single itemized bill, and it
does one thing Splitwise can't:

> **Divvy splits individual line items *unevenly*.** You add each item from the receipt,
> pick exactly who shared it, and weight shares per person (someone can count as 2×).
> Tax and tip are then allocated proportionally. Splitwise can only split an expense
> evenly (or by fixed amounts/percentages of the *whole* bill) — it has no concept of
> "Alice and Bob share the appetizer, everyone shares the pizza, and Carol counts double."

So Divvy does the hard, uneven, receipt-level math, then **pushes the result into Splitwise
as one correctly-divided expense** — it complements Splitwise rather than replacing it.

## Tech Stack

- **Backend:** Python 3 + Flask, `requests` (Splitwise HTTP), `pytest`
- **Frontend:** React 19 + TypeScript + Vite, Tailwind CSS v4, Framer Motion
- **Calculation core:** `bill_split.py` — a pure function shared by the CLI and the web API

## Getting Started

### Prerequisites

- Python 3.9+ (a virtualenv is expected at `./venv`)
- Node.js 18+ (for the frontend)

### Install

```bash
# Backend deps (into the venv)
./venv/bin/pip install -r requirements.txt

# Frontend deps
cd frontend && npm install
```

### Run the web app (two terminals)

```bash
# Terminal 1 — Flask API on :5001
./venv/bin/python app.py

# Terminal 2 — Vite dev server (proxies /api to the backend)
cd frontend && npm run dev
```

Open the URL Vite prints. It serves over **https** with a self-signed cert (from
`@vitejs/plugin-basic-ssl`), so accept the browser warning once.

To run a single-process production build instead, build the frontend and let Flask serve
it:

```bash
cd frontend && npm run build   # outputs to ../static/dist
./venv/bin/python app.py       # serves the built UI at http://localhost:5001
```

### Enable Splitwise (optional)

Export a personal Splitwise API key before starting the backend:

```bash
export SPLITWISE_API_KEY=<key>   # from https://secure.splitwise.com/apps
./venv/bin/python app.py
```

Without the key, Divvy runs as a normal local splitter and all Splitwise controls stay
hidden. The key is read only by the backend — it is **never** sent to the browser and must
not be committed (`.env` is gitignored).

### Run the terminal CLI

```bash
python bill_split.py
```

No external dependencies — standard library only.

## How the split works

When an item is shared by **everyone**, its cost is weighted by each person's share count.
When shared by **specific** people, the cost splits equally among them (share counts
ignored). Tax and tip are then distributed to each person in proportion to their pre-tax
subtotal. The results screen shows the total each person owes and what they owe the payer.

## Project Structure

```
bill_split.py        # Calculation core (compute_split) + interactive CLI
app.py               # Flask API: /api/calculate + /api/splitwise/* ; serves the built UI
splitwise_client.py  # Splitwise REST client + build_expense_payload (rounding reconciliation)
tests/               # pytest: payload builder, Splitwise client, Flask routes
frontend/            # React + TS + Vite web UI (the 5-step wizard)
```

## Tests

```bash
# Backend (pytest)
./venv/bin/python -m pytest

# Frontend type-check
cd frontend && npx tsc -b
```

## API

| Method & Path | Purpose |
| --- | --- |
| `POST /api/calculate` | Compute a split from `{ shares, items, payee, tax, tip }` |
| `GET /api/splitwise/status` | Whether a key is configured (drives the Splitwise UI) |
| `GET /api/splitwise/groups` / `friends` | Lists for the import pickers |
| `POST /api/splitwise/expense` | Create the computed split as a Splitwise expense |
