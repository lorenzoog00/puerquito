# Puerquito — Personal Finance App 🐷

**Date:** 2026-07-02
**Owner:** Lorenzo (single user)
**Status:** Design approved, pending spec review

## 1. Purpose

A private, single-user personal finance web app hosted on the EMporium VPS.
Tracks expenses/income, budgets & goals, accounts & balances, recurring bills,
and quincena-based savings (ahorro). All data entered manually. All records
fully editable.

## 2. Hosting & Domain

- Runs on the existing VPS (`root@5.78.198.194`) on **port 5002**
  (Color-Shift=5000, SipTrack=5001).
- Served under its **own domain** (TBD, e.g. `puerquito.app`) — NOT looqs.online.
  - DNS A record → `5.78.198.194`
  - Dedicated nginx server block + Let's Encrypt cert
  - looqs.online and all existing apps untouched
- Standard EMporium per-app deploy pattern:
  - Own Postgres user + database
  - Own systemd service (`deploy/puerquito.service`)
  - Own `.env` (created manually on server, NOT committed)
  - GitHub Actions deploy: push to `main` → SSH → git pull → npm install → build → restart
- Private financial data: nginx forces HTTPS; every route requires login.

## 3. Stack

- **Backend:** Express + TypeScript, Drizzle ORM → Postgres
- **Frontend:** React + Vite (plain web, no Expo), TanStack Query
- **Auth:** single user. Email + password (bcrypt-hashed), httpOnly secure
  session cookie. Credentials seeded from `.env` on first run. No public signup.
- **Currency:** default MXN, configurable per account. Single-currency display
  in v1 (no live FX).

## 4. Data Model (Postgres / Drizzle)

- **accounts** — id, name, type (cash | bank | card | savings), starting_balance,
  currency, created_at
- **categories** — id, name, type (expense | income), monthly_budget (nullable)
- **transactions** — id, date, amount, account_id, category_id, note,
  type (expense | income | transfer), created_at
- **recurring** — id, name, amount, category_id, account_id,
  frequency (weekly | monthly), next_due_date, active
- **savings_goal** — id, quincena_target (default per-quincena goal amount),
  overall_goal (nullable total target)
- **savings_entries** — id, year, month, quincena_half (1 = 1st–15th, 2 = 16th–end),
  amount_saved, goal_override (nullable, overrides quincena_target for this period),
  note

**Balances are computed** (starting_balance + transactions), never stored, so
they can't drift out of sync. Ahorro is an account of type `savings` and counts
toward net worth.

## 5. Quincena Logic

- A quincena = half a month: **half 1 = days 1–15**, **half 2 = day 16 – month end**.
- Each quincena has a **goal** (from `savings_goal.quincena_target`, or a
  `goal_override` on that period) and an **actual amount saved**
  (`savings_entries.amount_saved`).
- User enters the actual saved amount each quincena; shows actual vs goal.
- Everything editable after the fact — nothing locked.

## 6. Screens

1. **Login** — email + password.
2. **Dashboard** — net worth, this-month spend vs budget, saved-this-quincena vs
   goal, upcoming recurring bills, recent transactions.
3. **Transactions** — filterable list (month / category / account), quick add,
   edit/delete.
4. **Budgets** — per-category budget vs actual for the month, progress bars,
   overspend highlight.
5. **Accounts** — each account with computed live balance.
6. **Recurring** — recurring bills, next due dates, "mark paid" → creates a
   transaction.
7. **Ahorro** — per-quincena goal vs actual, enter amount saved, savings timeline
   chart, overall goal progress.

## 7. Architecture / Components

- `server/` — Express app: auth middleware, REST routes per resource
  (`/api/accounts`, `/api/transactions`, `/api/categories`, `/api/recurring`,
  `/api/savings`), Drizzle DB layer, session handling.
- `shared/` — Drizzle schema + Zod validators shared by server and client.
- `client/` — React + Vite SPA, TanStack Query for data fetching/caching,
  one page component per screen, shared UI components (forms, tables, charts).
- Server serves the built client static files in production (single service,
  single port 5002).

## 8. Error Handling

- Server: input validated with Zod at every route; typed error responses
  (400 validation, 401 unauthorized, 404 not found, 500 with logged detail).
- Client: TanStack Query error/loading states per screen; forms show inline
  validation and server errors; optimistic updates rolled back on failure.

## 9. Testing

- Server: unit tests for balance/quincena computation and validators;
  integration tests for each API route (auth required, CRUD, edge cases).
- Shared: schema/validator tests.
- Client: component tests for forms and the ahorro/budget calculations.

## 10. Out of Scope (YAGNI for v1)

No bank/auto sync, no multi-user, no mobile app, no investments/crypto,
no receipt photos, no multi-currency conversion. All addable later.

## 11. Open Items

- Final domain name to purchase/point.
- Confirm default quincena goal amount (set in-app after launch).
