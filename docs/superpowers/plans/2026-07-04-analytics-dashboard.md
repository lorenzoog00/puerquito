# Analytics Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Puerquito's home screen into a dashboard with spending/trend/budget/savings analytics, give every expense a required name, and let the user set real starting balances.

**Architecture:** A pure `buildAnalytics()` lib aggregates transactions/savings into compact JSON served by one new `/api/analytics` route; the home screen renders it with `recharts`. Named expenses add a nullable `name` column (required at the input validator). Starting balances reuse the existing accounts PATCH, back-computing `startingBalance` so the displayed balance matches what the user types.

**Tech Stack:** TypeScript, Express, Drizzle ORM (Postgres / PGlite for tests), React 18, react-router-dom v7, @tanstack/react-query, recharts, vitest + supertest.

## Global Constraints

- All money stored and passed as **integer cents**. Convert user input with `toCents()` (server) and render with the `<Money cents={...} />` component (client).
- UI copy is **Spanish** (es-MX).
- Backend routes are mounted via a `mountX(app)` function in `server/app.ts` and guarded with `requireAuth`.
- Input validation uses zod schemas in `shared/validators.ts`; routes call `schema.safeParse(req.body)` and return `400 { error: ... }` on failure.
- Backend changes are TDD (vitest + supertest, PGlite). Frontend changes have no test harness — verify with `npx tsc --noEmit` and manual `npm run local`.
- After any change to `shared/schema.ts`, regenerate migrations with `npm run db:generate` (tests apply `./drizzle` migrations).
- Commit after every task.

---

### Task 1: Named expenses — schema, validator, backend

**Files:**
- Modify: `shared/schema.ts` (transactions table + type)
- Modify: `shared/validators.ts:18-25` (transactionInput)
- Generate: `drizzle/0005_*.sql` (via `npm run db:generate`)
- Modify: `server/routes/transactions.ts:33-40` (POST insert)
- Modify: `server/routes/presets.ts:48-54` (log insert)
- Modify: `server/routes/recurring.ts:55-62` (pay insert)
- Modify: `server/lib/savingsTxn.ts:19-26` (transfer insert)
- Modify: `server/__tests__/transactions.int.test.ts:20` (add name to existing POST)
- Test: `server/__tests__/transactions.int.test.ts` (new cases)
- Test: `server/__tests__/presets.int.test.ts` (name-from-label case)

**Interfaces:**
- Produces: `transactions.name` (nullable text column); `transactionInput` now requires `name: string` (non-empty) and keeps `note: string | null | undefined`. Transaction rows returned by the API include `name`.

- [ ] **Step 1: Add the failing tests**

In `server/__tests__/transactions.int.test.ts`, first fix the existing POST on line 20 to include a name, then add new cases inside the `describe("transactions API", ...)` block:

```ts
// line 20 becomes:
await a.post("/api/transactions").send({ date: "2026-07-10", amount: 12.5, accountId: acc.body.id, type: "expense", name: "Tacos" });
```

```ts
it("requires a name", async () => {
  const a = request.agent(createApp());
  await a.post("/api/auth/login").send({ email: "me@test.com", password: "secret" });
  const acc = await a.post("/api/accounts").send({ name: "Cash", type: "cash" });
  const res = await a.post("/api/transactions").send({ date: "2026-07-10", amount: 5, accountId: acc.body.id, type: "expense" });
  expect(res.status).toBe(400);
});

it("stores name and optional note", async () => {
  const a = request.agent(createApp());
  await a.post("/api/auth/login").send({ email: "me@test.com", password: "secret" });
  const acc = await a.post("/api/accounts").send({ name: "Cash", type: "cash" });
  const res = await a.post("/api/transactions").send({ date: "2026-07-10", amount: 5, accountId: acc.body.id, type: "expense", name: "Uber", note: "al aeropuerto" });
  expect(res.status).toBe(200);
  expect(res.body.name).toBe("Uber");
  expect(res.body.note).toBe("al aeropuerto");
});
```

In `server/__tests__/presets.int.test.ts`, add a case asserting `/log` names the transaction from the preset label:

```ts
it("log sets transaction name from preset label", async () => {
  const a = request.agent(createApp());
  await a.post("/api/auth/login").send({ email: "me@test.com", password: "secret" });
  const acc = await a.post("/api/accounts").send({ name: "Card", type: "card" });
  const preset = await a.post("/api/presets").send({ label: "Cafecito", amount: 45, type: "expense", accountId: acc.body.id });
  const logged = await a.post(`/api/presets/${preset.body.id}/log`);
  expect(logged.body.name).toBe("Cafecito");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- transactions.int presets.int`
Expected: FAIL — "requires a name" gets 200 (not 400), name/label cases get `undefined`.

- [ ] **Step 3: Add the column to the schema**

In `shared/schema.ts`, add `name` to the `transactions` table (place it right after `date`):

```ts
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  name: text("name"), // required at the input validator; nullable in DB for legacy rows
  amount: integer("amount").notNull(), // cents, always positive
  accountId: integer("account_id").notNull().references(() => accounts.id),
  categoryId: integer("category_id").references(() => categories.id),
  note: text("note"),
  type: text("type").notNull(), // expense | income | transfer
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

- [ ] **Step 4: Generate the migration**

Run: `npm run db:generate`
Expected: a new file `drizzle/0005_*.sql` containing `ALTER TABLE "transactions" ADD COLUMN "name" text;`

- [ ] **Step 5: Require name in the validator**

In `shared/validators.ts`, update `transactionInput`:

```ts
export const transactionInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().min(1),
  amount: money,
  accountId: z.number().int().positive(),
  categoryId: z.number().int().positive().nullish(),
  note: z.string().nullish(),
  type: z.enum(["expense", "income", "transfer"]),
});
```

- [ ] **Step 6: Persist name in the transactions POST route**

In `server/routes/transactions.ts`, the insert `.values({...})` (around line 33) gains `name`:

```ts
    const [row] = await db.insert(transactions).values({
      date: p.data.date,
      name: p.data.name,
      amount: toCents(p.data.amount),
      accountId: p.data.accountId,
      categoryId: p.data.categoryId ?? null,
      note: p.data.note ?? null,
      type: p.data.type,
    }).returning();
```

- [ ] **Step 7: Name the internal inserts**

`server/routes/presets.ts` (`/log` insert): add `name: preset.label,` to the `.values({...})`.

`server/routes/recurring.ts` (`/pay` insert): add `name: rec.name,` to the `.values({...})`.

`server/lib/savingsTxn.ts` (`createSavingsTransfer` insert): add `name: note,` to the `.values({...})`.

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npm test -- transactions.int presets.int`
Expected: PASS.

- [ ] **Step 9: Run the full suite (guard against ripple)**

Run: `npm test`
Expected: all tests PASS (confirms no other test POSTs a nameless transaction).

- [ ] **Step 10: Commit**

```bash
git add shared/schema.ts shared/validators.ts drizzle/ server/routes/transactions.ts server/routes/presets.ts server/routes/recurring.ts server/lib/savingsTxn.ts server/__tests__/transactions.int.test.ts server/__tests__/presets.int.test.ts
git commit -m "feat: required name on expenses, named internal transactions"
```

---

### Task 2: Named expenses — Registrar input + list display

**Files:**
- Modify: `client/src/pages/Registrar.tsx`
- Modify: `client/src/pages/Dashboard.tsx:133-139` (recent movements label)
- Modify: `client/src/pages/Transactions.tsx` (row label)

**Interfaces:**
- Consumes: `transactionInput` requiring `name` (Task 1).
- Produces: a shared display convention — a transaction's shown label is `name ?? note ?? category-name ?? type`.

- [ ] **Step 1: Add a name field to Registrar**

In `client/src/pages/Registrar.tsx`, add state near the other `useState` hooks:

```tsx
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
```

Add inputs just above the `amount-display` div (after the presets block):

```tsx
      <input
        className="acc-select"
        placeholder="Nombre (ej. Tacos, Uber)"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
```

Update the guard and the POST body in `save()`:

```tsx
  function save() {
    if (cents <= 0 || !acc || !name.trim()) return;
    addTxn.mutate(
      {
        path: "/api/transactions",
        method: "POST",
        body: {
          date: new Date().toISOString().slice(0, 10),
          name: name.trim(),
          amount: cents / 100,
          accountId: Number(acc),
          categoryId: categoryId ? Number(categoryId) : null,
          type,
        },
      },
      {
        onSuccess: (row: any) => {
          notify("Movimiento registrado", () => delTxn.mutate({ path: `/api/transactions/${row.id}`, method: "DELETE" }));
          nav("/");
        },
      }
    );
  }
```

Update the Guardar button's disabled prop:

```tsx
      <button className="save-btn" disabled={cents <= 0 || !name.trim() || addTxn.isPending} onClick={save}>
        Guardar
      </button>
```

- [ ] **Step 2: Show the name in Inicio's recent movements**

In `client/src/pages/Dashboard.tsx`, the recent-movements label (around line 135) currently shows `t.note || t.type`. Change it to prefer the name:

```tsx
            <span>{t.name || t.note || t.type} <span className="muted" style={{ fontSize: 13 }}>· {t.date.slice(5)}</span></span>
```

- [ ] **Step 3: Show the name in Historial**

In `client/src/pages/Transactions.tsx`, the row's primary label is on line 43:

```tsx
              <div style={{ fontWeight: 600 }}>{t.note || catName(t.categoryId) || t.type}</div>
```

Change it to prefer the name:

```tsx
              <div style={{ fontWeight: 600 }}>{t.name || t.note || catName(t.categoryId) || t.type}</div>
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Manual verification**

Run: `npm run local`, open the app, go to Registrar, confirm Guardar is disabled until a name is typed, log "Tacos", and confirm it appears by name on Inicio and Historial.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/Registrar.tsx client/src/pages/Dashboard.tsx client/src/pages/Transactions.tsx
git commit -m "feat: name field in Registrar, show names in movement lists"
```

---

### Task 3: Set starting balances — Accounts adjust + Inicio nudge

**Files:**
- Modify: `shared/validators.ts:5-10` (allow negative startingBalance)
- Modify: `client/src/pages/Accounts.tsx`
- Modify: `client/src/pages/Dashboard.tsx` (nudge)

**Interfaces:**
- Consumes: `GET /api/accounts` returns each account with a computed `balance` and stored `startingBalance` (both cents); `PATCH /api/accounts/:id` accepts `{ startingBalance }` in **pesos** (server calls `toCents`).
- Produces: an "Ajustar saldo" flow that sets `startingBalance = enteredPesos − (balance − startingBalance)/100` so the displayed balance becomes the entered value.

- [ ] **Step 1: Allow a negative starting balance**

The back-compute can yield a negative baseline (when logged income exceeds the entered balance), which the `nonnegative()` `money` schema would reject. In `shared/validators.ts`, give `accountInput.startingBalance` its own signed coercion:

```ts
export const accountInput = z.object({
  name: z.string().min(1),
  type: z.enum(["cash", "bank", "card", "savings"]),
  startingBalance: z.coerce.number().default(0), // signed: adjust-balance can back-compute negatives
  currency: z.string().default("MXN"),
});
```

Run: `npm test -- accounts.int`
Expected: existing account tests still PASS.

- [ ] **Step 2: Add adjust-balance UI to Accounts**

In `client/src/pages/Accounts.tsx`, add state for the row being edited and its input value:

```tsx
  const [editId, setEditId] = useState<number | null>(null);
  const [bal, setBal] = useState("");
```

Add a helper that back-computes and patches (note: `balance` and `startingBalance` are cents; the PATCH body is pesos):

```tsx
  function saveBalance(a: any) {
    const enteredPesos = Number(bal);
    if (Number.isNaN(enteredPesos)) return;
    const txnDeltaPesos = (a.balance - a.startingBalance) / 100; // net effect of existing txns
    const newStartingPesos = enteredPesos - txnDeltaPesos;
    m.mutate({ path: `/api/accounts/${a.id}`, method: "PATCH", body: { startingBalance: newStartingPesos } });
    setEditId(null);
  }
```

In the account row, add an "Ajustar" button next to the balance, and render an inline editor when `editId === a.id`:

```tsx
            <span className="row">
              <strong><Money cents={a.balance} /></strong>
              <button onClick={() => { setEditId(a.id); setBal(String(a.balance / 100)); }}>Ajustar</button>
              <button className="danger" onClick={() => m.mutate({ path: `/api/accounts/${a.id}`, method: "DELETE" })}>✕</button>
            </span>
```

Directly below that row (inside the same `.map`), when editing:

```tsx
            {editId === a.id && (
              <div className="row" style={{ padding: "8px 0" }}>
                <input type="number" value={bal} onChange={(e) => setBal(e.target.value)} placeholder="Saldo real" />
                <button onClick={() => saveBalance(a)}>Guardar</button>
                <button onClick={() => setEditId(null)}>Cancelar</button>
              </div>
            )}
```

- [ ] **Step 3: Add the Inicio nudge**

In `client/src/pages/Dashboard.tsx`, just below the `hero card` div, show a one-line link to Cuentas when there is no spendable balance yet:

```tsx
      {disponible === 0 && (
        <Link to="/accounts" className="card" style={{ display: "block", textAlign: "center" }}>
          Configura los saldos de tus cuentas →
        </Link>
      )}
```

(`Link` is already imported in Dashboard.tsx.)

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Manual verification**

Run: `npm run local`. On Cuentas, tap Ajustar on an account, enter a real balance, Guardar, and confirm the shown balance matches exactly. Log an expense, then re-open Ajustar and confirm the pre-filled value equals the current balance and saving the same number leaves the balance unchanged (back-compute is correct).

- [ ] **Step 6: Commit**

```bash
git add shared/validators.ts client/src/pages/Accounts.tsx client/src/pages/Dashboard.tsx
git commit -m "feat: set/adjust account balance, Inicio setup nudge"
```

---

### Task 4: Analytics aggregation lib (pure, TDD)

**Files:**
- Create: `server/lib/analytics.ts`
- Test: `server/__tests__/analytics.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface AnalyticsInput {
    now: Date;
    months: number;                 // caller passes clamped 3 | 6 | 12
    accounts: { id: number; type: string; startingBalance: number }[];
    txns: { date: string; amount: number; type: string; categoryId: number | null; accountId: number }[]; // ALL txns
    categories: { id: number; name: string; monthlyBudget: number | null }[];
    savingsEntries: { year: number; month: number; amountSaved: number }[];
    goalContribs: { year: number; month: number; amount: number }[];
  }
  export interface AnalyticsResult {
    months: { ym: string; expense: number; income: number }[];
    categories: { id: number | null; name: string; spent: number; budget: number | null }[];
    savings: { ym: string; saved: number; cumulative: number }[];
    savingsRate: number;
    disponible: number;
  }
  export function ymList(now: Date, months: number): string[];
  export function buildAnalytics(input: AnalyticsInput): AnalyticsResult;
  ```

- [ ] **Step 1: Write the failing tests**

Create `server/__tests__/analytics.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { ymList, buildAnalytics } from "../lib/analytics";

const now = new Date("2026-07-15T12:00:00Z");

describe("ymList", () => {
  it("returns `months` ascending keys ending in the current month", () => {
    expect(ymList(now, 3)).toEqual(["2026-05", "2026-06", "2026-07"]);
  });
});

describe("buildAnalytics", () => {
  const base = {
    now, months: 3,
    accounts: [
      { id: 1, type: "bank", startingBalance: 100000 },
      { id: 2, type: "savings", startingBalance: 500000 },
    ],
    categories: [
      { id: 10, name: "Comida", monthlyBudget: 60000 },
      { id: 11, name: "Transporte", monthlyBudget: null },
    ],
    savingsEntries: [{ year: 2026, month: 7, amountSaved: 20000 }],
    goalContribs: [{ year: 2026, month: 6, amount: 5000 }],
  };

  it("buckets expense/income by month and excludes transfers", () => {
    const r = buildAnalytics({ ...base, txns: [
      { date: "2026-07-02", amount: 30000, type: "expense", categoryId: 10, accountId: 1 },
      { date: "2026-07-03", amount: 80000, type: "income",  categoryId: null, accountId: 1 },
      { date: "2026-07-04", amount: 10000, type: "transfer", categoryId: null, accountId: 1 },
      { date: "2026-06-10", amount: 15000, type: "expense", categoryId: 11, accountId: 1 },
    ]});
    expect(r.months).toEqual([
      { ym: "2026-05", expense: 0, income: 0 },
      { ym: "2026-06", expense: 15000, income: 0 },
      { ym: "2026-07", expense: 30000, income: 80000 },
    ]);
  });

  it("sums current-month expenses per category and keeps budgeted categories", () => {
    const r = buildAnalytics({ ...base, txns: [
      { date: "2026-07-02", amount: 30000, type: "expense", categoryId: 10, accountId: 1 },
    ]});
    const comida = r.categories.find((c) => c.id === 10);
    expect(comida).toEqual({ id: 10, name: "Comida", spent: 30000, budget: 60000 });
  });

  it("computes savings cumulative and savings rate for the current month", () => {
    const r = buildAnalytics({ ...base, txns: [
      { date: "2026-07-03", amount: 80000, type: "income", categoryId: null, accountId: 1 },
    ]});
    expect(r.savings).toEqual([
      { ym: "2026-05", saved: 0, cumulative: 0 },
      { ym: "2026-06", saved: 5000, cumulative: 5000 },
      { ym: "2026-07", saved: 20000, cumulative: 25000 },
    ]);
    expect(r.savingsRate).toBeCloseTo(20000 / 80000);
  });

  it("returns savingsRate 0 when income is 0", () => {
    const r = buildAnalytics({ ...base, txns: [] });
    expect(r.savingsRate).toBe(0);
  });

  it("disponible sums non-savings account balances over ALL txns", () => {
    const r = buildAnalytics({ ...base, txns: [
      { date: "2026-01-01", amount: 40000, type: "expense", categoryId: 10, accountId: 1 },
    ]});
    expect(r.disponible).toBe(60000); // 100000 starting - 40000 expense; savings acct excluded
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- analytics`
Expected: FAIL — module `../lib/analytics` not found.

- [ ] **Step 3: Implement the lib**

Create `server/lib/analytics.ts`:

```ts
import { applyTxn } from "./balance";

export interface AnalyticsInput {
  now: Date;
  months: number;
  accounts: { id: number; type: string; startingBalance: number }[];
  txns: { date: string; amount: number; type: string; categoryId: number | null; accountId: number }[];
  categories: { id: number; name: string; monthlyBudget: number | null }[];
  savingsEntries: { year: number; month: number; amountSaved: number }[];
  goalContribs: { year: number; month: number; amount: number }[];
}

export interface AnalyticsResult {
  months: { ym: string; expense: number; income: number }[];
  categories: { id: number | null; name: string; spent: number; budget: number | null }[];
  savings: { ym: string; saved: number; cumulative: number }[];
  savingsRate: number;
  disponible: number;
}

export function ymList(now: Date, months: number): string[] {
  const out: string[] = [];
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth(); // 0-based
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

export function buildAnalytics(input: AnalyticsInput): AnalyticsResult {
  const { now, months, accounts, txns, categories, savingsEntries, goalContribs } = input;
  const keys = ymList(now, months);
  const currentYm = keys[keys.length - 1];
  const ymOf = (isoDate: string) => isoDate.slice(0, 7);
  const ymKey = (year: number, month: number) => `${year}-${String(month).padStart(2, "0")}`;

  // months[] — expense/income per month, transfers excluded
  const monthsOut = keys.map((ym) => {
    let expense = 0, income = 0;
    for (const t of txns) {
      if (ymOf(t.date) !== ym) continue;
      if (t.type === "expense") expense += t.amount;
      else if (t.type === "income") income += t.amount;
    }
    return { ym, expense, income };
  });

  // categories[] — current-month expense per category; keep budgeted categories even at 0
  const spentByCat = new Map<number | null, number>();
  for (const t of txns) {
    if (t.type !== "expense" || ymOf(t.date) !== currentYm) continue;
    spentByCat.set(t.categoryId, (spentByCat.get(t.categoryId) ?? 0) + t.amount);
  }
  const categoriesOut: AnalyticsResult["categories"] = [];
  for (const c of categories) {
    const spent = spentByCat.get(c.id) ?? 0;
    if (spent === 0 && c.monthlyBudget == null) continue; // drop empty, unbudgeted
    categoriesOut.push({ id: c.id, name: c.name, spent, budget: c.monthlyBudget });
  }
  const uncategorized = spentByCat.get(null) ?? 0;
  if (uncategorized > 0) categoriesOut.push({ id: null, name: "Sin categoría", spent: uncategorized, budget: null });
  categoriesOut.sort((a, b) => b.spent - a.spent);

  // savings[] — savingsEntries + goalContributions per month, running cumulative over the range
  let cumulative = 0;
  const savingsOut = keys.map((ym) => {
    let saved = 0;
    for (const e of savingsEntries) if (ymKey(e.year, e.month) === ym) saved += e.amountSaved;
    for (const g of goalContribs) if (ymKey(g.year, g.month) === ym) saved += g.amount;
    cumulative += saved;
    return { ym, saved, cumulative };
  });

  const currentIncome = monthsOut[monthsOut.length - 1].income;
  const currentSaved = savingsOut[savingsOut.length - 1].saved;
  const savingsRate = currentIncome > 0 ? currentSaved / currentIncome : 0;

  const disponible = accounts
    .filter((a) => a.type !== "savings")
    .reduce((sum, a) => sum + applyTxn(a.startingBalance, txns.filter((t) => t.accountId === a.id)), 0);

  return { months: monthsOut, categories: categoriesOut, savings: savingsOut, savingsRate, disponible };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- analytics`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add server/lib/analytics.ts server/__tests__/analytics.test.ts
git commit -m "feat: buildAnalytics aggregation lib with unit tests"
```

---

### Task 5: Analytics route + client hook

**Files:**
- Create: `server/routes/analytics.ts`
- Modify: `server/app.ts` (import + mount)
- Test: `server/__tests__/analytics.int.test.ts`
- Modify: `client/src/hooks.ts` (useAnalytics)

**Interfaces:**
- Consumes: `buildAnalytics`, `ymList` (Task 4); Drizzle tables `accounts, transactions, categories, savingsEntries, goalContributions`.
- Produces: `GET /api/analytics?months=6` → `AnalyticsResult` JSON; client `useAnalytics(months: number)` react-query hook keyed `["analytics", months]`.

- [ ] **Step 1: Write the failing integration test**

Create `server/__tests__/analytics.int.test.ts`:

```ts
import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import bcrypt from "bcryptjs";
import request from "supertest";
import { createApp } from "../app";
import { resetDb } from "./helpers/testDb";

beforeAll(() => {
  process.env.SEED_EMAIL = "me@test.com";
  process.env.SEED_PASSWORD_HASH = bcrypt.hashSync("secret", 8);
});
beforeEach(async () => { await resetDb(); });

describe("analytics API", () => {
  it("requires auth", async () => {
    const res = await request(createApp()).get("/api/analytics");
    expect(res.status).toBe(401);
  });

  it("returns aggregated shape with clamped months", async () => {
    const a = request.agent(createApp());
    await a.post("/api/auth/login").send({ email: "me@test.com", password: "secret" });
    const acc = await a.post("/api/accounts").send({ name: "Bank", type: "bank", startingBalance: 1000 });
    const today = new Date().toISOString().slice(0, 10);
    await a.post("/api/transactions").send({ date: today, name: "Tacos", amount: 100, accountId: acc.body.id, type: "expense" });
    const res = await a.get("/api/analytics?months=99"); // invalid → clamp to 6
    expect(res.status).toBe(200);
    expect(res.body.months).toHaveLength(6);
    expect(res.body.disponible).toBe(90000); // 1000.00 - 100.00 pesos, in cents
    const current = res.body.months[res.body.months.length - 1];
    expect(current.expense).toBe(10000);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- analytics.int`
Expected: FAIL — `/api/analytics` 404 (route not mounted).

- [ ] **Step 3: Implement the route**

Create `server/routes/analytics.ts`:

```ts
import type { Express } from "express";
import { db } from "../db";
import { accounts, transactions, categories, savingsEntries, goalContributions } from "@shared/schema";
import { requireAuth } from "../auth";
import { buildAnalytics } from "../lib/analytics";

const ALLOWED = [3, 6, 12];

export function mountAnalytics(app: Express) {
  app.get("/api/analytics", requireAuth, async (req, res) => {
    const raw = Number(req.query.months);
    const months = ALLOWED.includes(raw) ? raw : 6;
    const [accts, txns, cats, savEntries, goalContribs] = await Promise.all([
      db.select().from(accounts),
      db.select().from(transactions),
      db.select().from(categories),
      db.select().from(savingsEntries),
      db.select().from(goalContributions),
    ]);
    res.json(buildAnalytics({
      now: new Date(),
      months,
      accounts: accts,
      txns,
      categories: cats,
      savingsEntries: savEntries,
      goalContribs,
    }));
  });
}
```

- [ ] **Step 4: Mount the route**

In `server/app.ts`, add the import near the other route imports:

```ts
import { mountAnalytics } from "./routes/analytics";
```

And call it alongside the others (after `mountGoals(app);`):

```ts
  mountAnalytics(app);
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- analytics.int`
Expected: PASS.

- [ ] **Step 6: Add the client hook**

In `client/src/hooks.ts`, add:

```ts
export const useAnalytics = (months: number) =>
  useQuery({ queryKey: ["analytics", months], queryFn: () => api(`/api/analytics?months=${months}`) });
```

- [ ] **Step 7: Typecheck + full suite**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors; all tests PASS.

- [ ] **Step 8: Commit**

```bash
git add server/routes/analytics.ts server/app.ts server/__tests__/analytics.int.test.ts client/src/hooks.ts
git commit -m "feat: /api/analytics route + useAnalytics hook"
```

---

### Task 6: "Tu dinero" analytics section (charts)

**Files:**
- Create: `client/src/pages/Analisis.tsx`
- Modify: `client/src/pages/Dashboard.tsx` (render `<Analisis />` below existing blocks)

**Interfaces:**
- Consumes: `useAnalytics(months)` returning `AnalyticsResult` (Task 5); `<Money cents>`; recharts.
- Produces: `<Analisis />` default-exported-less named export rendered inside the home screen.

- [ ] **Step 1: Build the Analisis component**

Create `client/src/pages/Analisis.tsx`:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, AreaChart, Area, ResponsiveContainer, Tooltip } from "recharts";
import { useAnalytics } from "../hooks";
import { Money } from "../components/Money";

const RANGES = [3, 6, 12];
const COLORS = ["#e5679a", "#f4a259", "#5b8e7d", "#6a8eae", "#bc6c25", "#8367c7", "#43aa8b"];

export function Analisis() {
  const nav = useNavigate();
  const [months, setMonths] = useState(6);
  const { data, isLoading } = useAnalytics(months);

  if (isLoading || !data) return <div className="card"><p className="muted">Cargando análisis…</p></div>;

  const expenseCats = data.categories.filter((c: any) => c.spent > 0);
  const totalSpent = expenseCats.reduce((s: number, c: any) => s + c.spent, 0);
  const monthsData = data.months.map((m: any) => ({ ...m, label: m.ym.slice(5) }));
  const withData = data.months.filter((m: any) => m.expense > 0 || m.income > 0).length;
  const thisMonth = data.months[data.months.length - 1];
  const prevMonth = data.months[data.months.length - 2];
  const delta = prevMonth ? thisMonth.expense - prevMonth.expense : 0;
  const budgeted = data.categories.filter((c: any) => c.budget != null);
  const savingsData = data.savings.map((s: any) => ({ ...s, label: s.ym.slice(5) }));

  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="between">
        <h3 style={{ margin: 0 }}>Tu dinero</h3>
        <div className="seg" style={{ width: "auto" }}>
          {RANGES.map((r) => (
            <button key={r} className={months === r ? "on" : ""} onClick={() => setMonths(r)}>{r}m</button>
          ))}
        </div>
      </div>

      {/* Block 1 — where money goes */}
      <div className="card">
        <h4 style={{ margin: "0 0 8px" }}>¿A dónde se va?</h4>
        {totalSpent === 0 ? (
          <p className="muted">Aún no hay gastos este mes.</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={expenseCats} dataKey="spent" nameKey="name" innerRadius={50} outerRadius={80}>
                  {expenseCats.map((c: any, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]}
                      onClick={() => c.id != null && nav(`/historial?categoryId=${c.id}`)} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => "$" + (v / 100).toFixed(2)} />
              </PieChart>
            </ResponsiveContainer>
            {expenseCats.map((c: any, i: number) => (
              <div key={c.id ?? "none"} className="between goal-row"
                onClick={() => c.id != null && nav(`/historial?categoryId=${c.id}`)}>
                <span><span style={{ color: COLORS[i % COLORS.length] }}>●</span> {c.name}</span>
                <span><Money cents={c.spent} /> <span className="muted" style={{ fontSize: 13 }}>{Math.round((c.spent / totalSpent) * 100)}%</span></span>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Block 2 — trend */}
      <div className="card">
        <h4 style={{ margin: "0 0 8px" }}>Tendencia</h4>
        {withData < 2 ? (
          <p className="muted">Aún no hay suficientes datos.</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={monthsData}>
                <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v: any) => "$" + (v / 100).toFixed(2)} />
                <Bar dataKey="income" fill="#5b8e7d" radius={[3, 3, 0, 0]} />
                <Bar dataKey="expense" fill="#e5679a" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <p className="muted" style={{ margin: "6px 0 0" }}>
              {delta === 0 ? "Igual que el mes pasado" :
                delta > 0 ? <>Gastas <Money cents={delta} /> más que el mes pasado</> :
                <>Gastas <Money cents={-delta} /> menos que el mes pasado</>}
            </p>
          </>
        )}
      </div>

      {/* Block 3 — on track */}
      <div className="card">
        <h4 style={{ margin: "0 0 8px" }}>¿Vas bien?</h4>
        {budgeted.length === 0 ? (
          <p className="muted">Agrega presupuestos por categoría para ver tu avance.</p>
        ) : budgeted.map((c: any) => {
          const pct = Math.min(100, Math.round((c.spent / c.budget) * 100));
          const color = pct < 75 ? "#5b8e7d" : pct < 100 ? "#f4a259" : "#e5679a";
          return (
            <div key={c.id} style={{ margin: "8px 0" }}>
              <div className="between" style={{ fontSize: 14 }}>
                <span>{c.name}</span>
                <span><Money cents={c.spent} /> / <Money cents={c.budget} /></span>
              </div>
              <div style={{ height: 8, background: "#eee", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: pct + "%", height: "100%", background: color }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Block 4 — savings */}
      <div className="card">
        <h4 style={{ margin: "0 0 8px" }}>Ahorro</h4>
        {withData < 2 ? (
          <p className="muted">Aún no hay suficientes datos.</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={savingsData}>
                <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v: any) => "$" + (v / 100).toFixed(2)} />
                <Area dataKey="cumulative" stroke="#5b8e7d" fill="#c9e4d8" />
              </AreaChart>
            </ResponsiveContainer>
            <p className="muted" style={{ margin: "6px 0 0" }}>
              Este mes ahorraste el {Math.round(data.savingsRate * 100)}% de tus ingresos
            </p>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Render it on the home screen**

In `client/src/pages/Dashboard.tsx`, import and render `<Analisis />` at the bottom of the returned `.screen` div (after the "Últimos movimientos" card):

```tsx
import { Analisis } from "./Analisis";
```

```tsx
      <Analisis />
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual verification**

Run: `npm run local`. Log a few expenses across categories (set a `monthlyBudget` on a category first if none exists). Confirm on Inicio: the donut renders with a ranked list, the range toggle (3/6/12) refetches, budget bars change color as spend approaches the budget, and empty states show "Aún no hay suficientes datos" for the trend/savings charts when there is <2 months of data.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/Analisis.tsx client/src/pages/Dashboard.tsx
git commit -m "feat: Tu dinero analytics section on the home screen"
```

---

### Task 7: Historial category filter (slice tap target)

**Files:**
- Modify: `client/src/pages/Transactions.tsx`

**Interfaces:**
- Consumes: navigation `"/historial?categoryId=<id>"` produced by the donut (Task 6); `useCategories()`; `useTransactions(month)`.
- Produces: Historial pre-filters its list to the `categoryId` query param when present, with a clearable filter chip.

- [ ] **Step 1: Read the query param and filter**

In `client/src/pages/Transactions.tsx`, add `useSearchParams` to the existing router-less import list (line 1 imports from `react`; add a new import line):

```tsx
import { useSearchParams } from "react-router-dom";
```

Inside the component, after `const [month, setMonth] = useState(thisMonth());` (line 11), read the param and derive the filtered list (place after the `income` computation on line 21):

```tsx
  const [params, setParams] = useSearchParams();
  const catFilter = params.get("categoryId");
  const shown = catFilter ? txns.filter((t: any) => String(t.categoryId) === catFilter) : txns;
```

Change the list map on line 40 from `txns.map(...)` to `shown.map(...)`, and the empty check on line 54 from `txns.length === 0` to `shown.length === 0`.

- [ ] **Step 2: Add a clearable filter chip**

Above the list, when a filter is active, show which category and a clear button:

```tsx
  {catFilter && (
    <div className="between card">
      <span>Categoría: {catName(Number(catFilter)) || "—"}</span>
      <button onClick={() => setParams({})}>Quitar filtro ✕</button>
    </div>
  )}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual verification**

Run: `npm run local`. On Inicio, tap a donut slice → lands on Historial showing only that category's transactions with a "Quitar filtro" chip; tapping it clears the filter.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/Transactions.tsx
git commit -m "feat: Historial filters by categoryId from analytics donut"
```

---

## Notes for the executor

- If `npm run db:generate` prompts about column changes, accept the generated migration; do not hand-edit the SQL.
- The donut "Sin categoría" slice has `id: null` and is intentionally not tappable (no category to filter by).
- `disponible` in the analytics response is computed over **all** transactions (not just the range), matching the Inicio hero; the month/category/savings blocks are range-scoped.
- Frontend has no automated test harness — the `tsc --noEmit` + `npm run local` steps are the verification of record for Tasks 2, 3, 6, 7.
