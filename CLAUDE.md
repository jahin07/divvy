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
- **`GET /<path>`** — serves the built frontend from `static/dist` (SPA fallback to
  `index.html`).
- Run with `python app.py` (uses `debug=True`).

### `frontend/` — React web UI

Vite + React 19 + TypeScript + Tailwind CSS v4 + Framer Motion. A 5-step wizard:
**People → Payee → Items → Tax/Tip → Results**.

- `src/App.tsx` — wizard orchestration and per-step validation gating (`goToStep`).
- `src/hooks/useWizard.ts` — `useReducer` state machine for the wizard (`WizardState`/`WizardAction`).
- `src/hooks/useCalculate.ts` — POSTs to `/api/calculate` and returns `{ data | error }`.
- `src/components/Step*.tsx` — one component per wizard step; `src/components/ui/` — shared primitives.
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

The CLI has no external dependencies (standard library only). The web stack adds Flask
(see `venv/`) and the frontend's npm dependencies.

## Key Design Detail

When an item is shared by `"all"`, its cost is weighted by each person's share count.
When shared by specific names, the cost splits **equally** among those people (ignoring
share counts). Tax and tip are then allocated to each person in proportion to their
pre-tax subtotal.
