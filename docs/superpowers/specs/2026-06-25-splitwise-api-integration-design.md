# Splitwise API Integration — Design

**Date:** 2026-06-25
**Status:** Approved (design), pending implementation plan

## Goal

Let the Divvy bill-splitter work *with* a real Splitwise account, in two directions:

1. **Import** — pull the user's Splitwise friends or a group's members into the People
   step, so participants carry real Splitwise user IDs instead of free-typed names.
2. **Export** — after the wizard computes the split, push it to Splitwise as a real
   expense (within a group, or as a non-group friends expense).

Splitwise is **additive**: the existing local-only flow keeps working untouched. Import
and push are optional enhancements.

## Authentication

- **Personal API key only** (single-user). No OAuth flow, no per-user token storage.
- The key is read by the Flask backend from the `SPLITWISE_API_KEY` environment variable.
- The frontend never sees the key — it only talks to our own `/api/splitwise/*` routes.
- Splitwise auth header: `Authorization: Bearer <key>`.
- Base URL: `https://secure.splitwise.com/api/v3.0`.

## Architecture

Chosen approach: **backend proxy + raw HTTP** (via `requests`). The Flask server holds the
key and exposes our own endpoints; the React app talks only to our backend. Rejected
alternatives: browser calling Splitwise directly (leaks the key, CORS), and the official
`splitwise` SDK (extra dependency, hides the wire format).

### New module: `splitwise_client.py`

A thin wrapper over the Splitwise REST API. No Flask knowledge — pure HTTP, dict in / dict
out, so it is unit-testable in isolation. Reads `SPLITWISE_API_KEY` from the environment.

Functions:

- `get_current_user() -> dict` — the authenticated user (id, name). Used for status and to
  identify "me" as a potential payee.
- `get_groups() -> list[dict]` — each: `{ id, name, members: [{ id, name }] }`.
- `get_friends() -> list[dict]` — each: `{ id, name }`.
- `create_expense(cost, description, group_id, users) -> dict` — creates the expense and
  returns Splitwise's response (including the new expense id / any errors).

A small custom error type (e.g. `SplitwiseError`) carries a message + HTTP status so routes
can surface friendly errors. A missing/empty `SPLITWISE_API_KEY` raises a clear
"not configured" error.

### New Flask routes in `app.py`

- `GET /api/splitwise/status` — `{ configured: bool, user?: {id, name} }`. Drives whether
  the UI shows Splitwise features. Never 500s on a missing key — returns `configured: false`.
- `GET /api/splitwise/groups` — list of groups with members.
- `GET /api/splitwise/friends` — list of friends.
- `POST /api/splitwise/expense` — body: `{ result, payeeName, mapping, groupId|null }` where
  `result` is the `compute_split` output and `mapping` resolves each person name →
  Splitwise user id. Builds the Splitwise `users[]` payload (see below) and calls
  `create_expense`. Returns `{ ok, expenseId }` or an error.

### Frontend changes

- `types.ts`: `Person` gains optional `splitwiseId?: number`.
- **People step (`StepPeople`)**: add an "Import from Splitwise" path. The user chooses
  **Group** or **Friends** at runtime (driven by `/status` being `configured`), fetches the
  relevant list, selects members, and those populate People with `splitwiseId` attached.
  Manual typing still works for purely-local splits.
- **Results step (`StepResults`)**: add a "Push to Splitwise" button, enabled only when
  every participant has a `splitwiseId` (and, for a group expense, a group is selected).
  Posts to `/api/splitwise/expense` and shows success (with the expense id) or the error.
- A small `useSplitwise` hook mirrors `useCalculate` for the new fetch calls.

## Data Flow: Building the Expense Payload

From `compute_split`'s result dict:

- `cost` = `result.total_paid` (the full amount the payee laid out).
- `description` = a sensible default (e.g. "Divvy split — <date>"), editable later.
- For each person `p` with Splitwise id `uid`:
  - `owed_share[uid]` = `result.breakdown[p].total`
  - `paid_share[uid]` = `result.total_paid` if `p == payee` else `0`
- Splitwise `users[]` entries: `{ user_id, paid_share, owed_share }` as 2-decimal strings.

### Penny-rounding reconciliation (critical)

`compute_split` rounds each person to 2 decimals, so `sum(owed_share)` may differ from
`cost` by a cent or two. **Splitwise rejects** an expense unless
`sum(paid_share) == sum(owed_share) == cost`. So the payload builder must:

1. Compute all owed shares.
2. Compute `delta = cost - sum(owed_shares)` (in cents).
3. Add `delta` to one participant's owed share (the largest owed share, to minimize relative
   distortion) so the totals reconcile exactly.

The paid side is trivially correct (one payer with the full `cost`).

This reconciliation lives in a **pure function** (`build_expense_payload`) separate from the
HTTP call, so it can be unit-tested directly.

## Error Handling

- Missing/empty API key: `/status` returns `configured: false`; other routes return a 400
  with "Splitwise API key not configured."
- Splitwise API errors (auth failure, validation, network): caught and returned as a 4xx/5xx
  with the upstream message; the frontend surfaces it in the existing error UI.
- Push button disabled unless all participants have `splitwiseId`, preventing the common
  "unknown user" failure before it reaches Splitwise.

## Testing

- **`build_expense_payload`** (pure): unit tests including rounding edge cases (shares that
  sum to one/two cents over/under cost; single non-payee; weighted shares).
- **`splitwise_client`**: tests with the HTTP layer mocked — correct URLs, headers, payload
  shape, and error mapping.
- **Flask routes**: tests with `splitwise_client` mocked — status with/without key, list
  pass-through, expense happy path and error path.
- The existing `compute_split` and local flow are unchanged and remain covered.

## Dependencies

- Add `requests` to the backend virtualenv (`venv/`).
- No new frontend dependencies.

## Out of Scope (YAGNI)

- OAuth2 / multi-user accounts.
- Pulling existing Splitwise expenses into the app.
- Editing/deleting Splitwise expenses after creation.
- Persisting any Splitwise data locally.
