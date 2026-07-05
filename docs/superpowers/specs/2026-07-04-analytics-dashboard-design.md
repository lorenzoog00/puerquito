# Analytics Dashboard — Design Spec

**Date:** 2026-07-04
**App:** Puerquito (personal finance, phone-native, Spanish UI)
**Goal:** Give Lorenzo real insight into spending, trends, budgets, and savings — turn the home screen into a dashboard without losing the daily quick-log flow.

## Problem

Puerquito already tracks spending, savings, and goals (Inicio, Registrar/Historial, Presupuestos, Ahorro, Metas, Recurrentes, Cuentas). What's missing is **insight**: there is no visual answer to "where did my money go, am I spending more than last month, am I on budget, is my savings growing?" `recharts` is installed but unused.

## Decision

- **Placement:** The home screen (`/`, `Dashboard.tsx`) stays as-is at the top (Dinero disponible hero, "Esta quincena" checklist, presets, last movements) and gains a new **"Tu dinero"** analytics section below. No new nav tab — the 5-tab bottom nav is unchanged.
- **Approach:** **A — Server analytics endpoint.** One new `/api/analytics` route does SQL aggregation and returns compact JSON; the client only renders charts. Chosen over client-side aggregation (B) and hybrid (C) for a single tested module, speed, and scaling.

## Scope (the 4 blocks)

A month-range toggle (**3 / 6 / 12 meses**, default 6) controls the historical blocks (2 and 4). Blocks 1 and 3 are always current month.

1. **¿A dónde se va?** — Donut of the current month's expenses by category + ranked list (amount, % of total). Tapping a slice navigates to Historial filtered by that category.
2. **Tendencia** — Bar chart, one pair of bars per month in the range (gasto vs ingreso). Shows a "vs mes pasado" delta on this month's total spend.
3. **¿Vas bien?** — For each category that has a `monthlyBudget`: a progress bar (gastado / presupuesto), colored green → amber → red by usage. Includes "te quedan $X para la quincena" derived from remaining budget. Categories with no budget are omitted.
4. **Ahorro** — Area/line of cumulative savings over the range (from `savingsEntries` + `goalContributions`), the current-month savings rate (ahorro ÷ ingreso), and progress toward each meta's `targetAmount` / `overallGoal`.

## Backend

New file `server/routes/analytics.ts`, mounted alongside the other routes in `server/app.ts`, guarded by `requireAuth`.

**Endpoint:** `GET /api/analytics?months=6`
- `months` clamped to one of {3, 6, 12}; invalid → default 6.

**Response (all money in integer cents, matching existing convention):**
```json
{
  "months": [{ "ym": "2026-02", "expense": 123400, "income": 200000 }],
  "categories": [{ "id": 3, "name": "Comida", "spent": 45000, "budget": 60000 }],
  "savings":   [{ "ym": "2026-02", "saved": 50000, "cumulative": 350000 }],
  "savingsRate": 0.25,
  "disponible": 812300
}
```

- `months[]`: per-month sums of `transactions` where `type = 'expense'` (→ expense) and `type = 'income'` (→ income), bucketed by `to_char(date,'YYYY-MM')`, covering the requested range including the current month. Months with no data appear with zeros.
- `categories[]`: current-month expense sum per category (LEFT JOIN so every category with a `monthlyBudget` appears even at 0 spent); includes `budget` from `categories.monthlyBudget`. Categories with `spent = 0` and no budget are excluded.
- `savings[]`: per-month sum of `savingsEntries.amountSaved` + `goalContributions.amount`, plus a running `cumulative` across the range.
- `savingsRate`: current-month saved ÷ current-month income; `0` when income is 0 (guard divide-by-zero).
- `disponible`: sum of non-`savings` account balances (same computation as today's hero), for convenience.

`transfer` transactions are excluded from expense/income sums (they move money between accounts, not spending).

## Frontend

- New `client/src/pages/Analisis.tsx` — the "Tu dinero" section, rendered by `Dashboard.tsx` below the existing blocks. Not routed separately.
- New hook `useAnalytics(months: number)` in `client/src/hooks.ts` → `GET /api/analytics?months=${months}`.
- Local `useState` for the 3/6/12 range toggle, default 6.
- Charts via the installed `recharts`: `PieChart` (donut, block 1), `BarChart` (block 2), `AreaChart` (block 4). Block 3 is plain CSS progress bars (no chart lib needed). All wrapped in the existing `.card` styling for a consistent phone-native look.
- Reuses `<Money>` for all amounts and existing color tokens (`--good`, `--ink`, etc.). Category colors: a small fixed palette cycled per slice.
- Slice tap → `navigate("/historial?categoryId=" + id)`; Historial reads the query param to pre-filter (small addition to `Transactions.tsx`).

## Error & empty states

- Query loading: lightweight skeleton/placeholder, no layout jump.
- Not enough data (new user / single month): each block renders "Aún no hay suficientes datos" instead of an empty or broken chart. Threshold: block 2/4 need ≥ 2 months with data; block 1 needs ≥ 1 expense; block 3 needs ≥ 1 category with a budget.
- Divide-by-zero guarded for `savingsRate` and category `%`.

## Testing

New `server/__tests__/analytics.test.ts` (vitest + PGlite local DB, same harness as the existing 20 tests). Covers:
- Category sums bucket correctly and respect `type`.
- `transfer` excluded from expense/income.
- Month bucketing includes empty months as zeros and honors the `months` clamp.
- `savingsRate` = saved/income, and `= 0` when income is 0.
- `cumulative` savings is monotonic across the range.
- Auth required (401 without session).

## Out of scope (YAGNI)

- Net-worth-over-time from historical account balances (needs balance snapshots we don't store) — savings cumulative covers the "is it growing" question for now.
- CSV export, custom date ranges beyond 3/6/12, multi-currency analytics.
- Any change to the existing daily-logging flow.
