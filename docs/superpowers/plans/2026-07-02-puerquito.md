# Puerquito Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Puerquito, a private single-user personal-finance web app (transactions, budgets, accounts, recurring bills, quincena savings) and deploy it to the EMporium VPS on its own domain with CI/CD.

**Architecture:** A single Node service. Express + TypeScript serves a REST API and, in production, the built React/Vite SPA. Drizzle ORM over Postgres. Auth is a single seeded user with a bcrypt password and an httpOnly session cookie. Deployed via systemd + nginx + Let's Encrypt, auto-deployed by GitHub Actions on push to `main`.

**Tech Stack:** Node 20+, Express 5, TypeScript, Drizzle ORM, Postgres, Zod, express-session, bcryptjs, Vite, React 18, React Router, TanStack Query, Recharts, Vitest, Supertest.

## Global Constraints

- Node version floor: **20** (`engines.node >= 20`).
- Single user only — no signup route. Credentials seeded from env: `SEED_EMAIL`, `SEED_PASSWORD`.
- Default currency: **MXN**. Amounts stored as **integer cents** (avoid float drift).
- Quincena halves: **half 1 = days 1–15**, **half 2 = day 16 – month end**.
- Balances are **computed**, never stored.
- `.env` is **never committed**. Provide `.env.example`.
- App listens on **port 5002** (env `PORT`).
- Server dir on VPS: `/root/apps/puerquito/Puerquito/`.
- Every API route except `/api/auth/login` requires an authenticated session.
- All money math and quincena logic must have unit tests (TDD).
- Commit after every task.

---

## File Structure

```
Puerquito/
├── package.json
├── tsconfig.json                 # server + shared
├── vite.config.ts                # client build
├── drizzle.config.ts
├── .env.example
├── .gitignore
├── .github/workflows/deploy.yml
├── deploy/puerquito.service
├── deploy/nginx-puerquito.conf
├── shared/
│   ├── schema.ts                 # Drizzle tables
│   └── validators.ts             # Zod schemas
├── server/
│   ├── index.ts                  # Express bootstrap, static serving
│   ├── db.ts                     # Drizzle client
│   ├── auth.ts                   # session config, login, requireAuth
│   ├── lib/money.ts              # cents helpers
│   ├── lib/quincena.ts           # quincena helpers
│   ├── lib/balance.ts            # account balance computation
│   └── routes/
│       ├── accounts.ts
│       ├── categories.ts
│       ├── transactions.ts
│       ├── recurring.ts
│       └── savings.ts
├── server/__tests__/             # vitest + supertest
├── client/
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── api.ts                # fetch wrapper + query hooks
│       ├── auth.tsx              # auth context + ProtectedRoute
│       ├── App.tsx               # router
│       ├── components/           # shared UI (Money, forms, layout)
│       └── pages/                # Login, Dashboard, Transactions,
│                                 #   Budgets, Accounts, Recurring, Ahorro
```

---

## Task 1: Project scaffold & tooling

**Files:**
- Create: `package.json`, `tsconfig.json`, `.gitignore`, `.env.example`, `drizzle.config.ts`, `vite.config.ts`

**Interfaces:**
- Produces: npm scripts `dev:server`, `dev:client`, `build`, `start`, `test`, `db:push`; env var names `DATABASE_URL`, `SESSION_SECRET`, `SEED_EMAIL`, `SEED_PASSWORD`, `PORT`.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "puerquito",
  "version": "1.0.0",
  "type": "module",
  "engines": { "node": ">=20" },
  "scripts": {
    "dev:server": "tsx watch server/index.ts",
    "dev:client": "vite",
    "build:client": "vite build",
    "build:server": "esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outfile=dist/server.js",
    "build": "npm run build:client && npm run build:server",
    "start": "node dist/server.js",
    "db:push": "drizzle-kit push",
    "db:seed": "tsx server/seed.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "connect-pg-simple": "^9.0.1",
    "dotenv": "^16.4.5",
    "drizzle-orm": "^0.39.3",
    "drizzle-zod": "^0.7.0",
    "express": "^4.21.2",
    "express-session": "^1.18.1",
    "pg": "^8.13.1",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "@types/express": "^4.17.21",
    "@types/express-session": "^1.18.0",
    "@types/pg": "^8.11.10",
    "@vitejs/plugin-react": "^4.3.4",
    "drizzle-kit": "^0.30.4",
    "esbuild": "^0.24.2",
    "supertest": "^7.0.0",
    "@types/supertest": "^6.0.2",
    "tsx": "^4.19.2",
    "typescript": "^5.7.3",
    "vite": "^6.0.7",
    "vitest": "^2.1.8",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "@types/react": "^18.3.18",
    "@types/react-dom": "^18.3.5",
    "react-router-dom": "^7.1.1",
    "@tanstack/react-query": "^5.64.1",
    "recharts": "^2.15.0"
  }
}
```

> Note: Express 4 is used (not 5) for stable `express-session`/`supertest` compatibility.

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "types": ["node"],
    "jsx": "react-jsx",
    "baseUrl": ".",
    "paths": { "@shared/*": ["shared/*"] }
  },
  "include": ["server", "shared", "client/src"]
}
```

- [ ] **Step 3: Create `.gitignore`**

```
node_modules
dist
.env
*.log
```

- [ ] **Step 4: Create `.env.example`**

```
DATABASE_URL=postgres://puerquito:CHANGEME@localhost:5432/puerquito
SESSION_SECRET=CHANGE_ME_LONG_RANDOM
SEED_EMAIL=you@example.com
SEED_PASSWORD=CHANGE_ME
PORT=5002
NODE_ENV=development
```

- [ ] **Step 5: Create `drizzle.config.ts`**

```ts
import type { Config } from "drizzle-kit";
import "dotenv/config";

export default {
  schema: "./shared/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
} satisfies Config;
```

- [ ] **Step 6: Create `vite.config.ts`**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  root: "client",
  plugins: [react()],
  resolve: { alias: { "@shared": path.resolve(__dirname, "shared") } },
  build: { outDir: "../dist/client", emptyOutDir: true },
  server: { port: 5173, proxy: { "/api": "http://localhost:5002" } },
});
```

- [ ] **Step 7: Install and commit**

Run: `npm install`
Expected: installs without error, creates `package-lock.json`.

```bash
git add -A
git commit -m "chore: scaffold Puerquito project and tooling"
```

---

## Task 2: Database schema

**Files:**
- Create: `shared/schema.ts`
- Test: `server/__tests__/schema.test.ts`

**Interfaces:**
- Produces: tables `accounts`, `categories`, `transactions`, `recurring`, `savingsGoal`, `savingsEntries`, plus inferred types `Account`, `NewAccount`, etc. Amounts are integer cents. `accounts.type` ∈ `cash|bank|card|savings`; `categories.type` and `transactions.type` per spec.

- [ ] **Step 1: Write `shared/schema.ts`**

```ts
import { pgTable, serial, text, integer, date, boolean, timestamp } from "drizzle-orm/pg-core";

export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(), // cash | bank | card | savings
  startingBalance: integer("starting_balance").notNull().default(0), // cents
  currency: text("currency").notNull().default("MXN"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),           // expense | income
  monthlyBudget: integer("monthly_budget"), // cents, nullable
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  amount: integer("amount").notNull(),     // cents, always positive
  accountId: integer("account_id").notNull().references(() => accounts.id),
  categoryId: integer("category_id").references(() => categories.id),
  note: text("note"),
  type: text("type").notNull(),            // expense | income | transfer
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const recurring = pgTable("recurring", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  amount: integer("amount").notNull(),     // cents
  categoryId: integer("category_id").references(() => categories.id),
  accountId: integer("account_id").notNull().references(() => accounts.id),
  frequency: text("frequency").notNull(),  // weekly | monthly
  nextDueDate: date("next_due_date").notNull(),
  active: boolean("active").notNull().default(true),
});

export const savingsGoal = pgTable("savings_goal", {
  id: serial("id").primaryKey(),
  quincenaTarget: integer("quincena_target").notNull().default(0), // cents
  overallGoal: integer("overall_goal"),                            // cents, nullable
});

export const savingsEntries = pgTable("savings_entries", {
  id: serial("id").primaryKey(),
  year: integer("year").notNull(),
  month: integer("month").notNull(),        // 1-12
  quincenaHalf: integer("quincena_half").notNull(), // 1 | 2
  amountSaved: integer("amount_saved").notNull(),   // cents
  goalOverride: integer("goal_override"),           // cents, nullable
  note: text("note"),
});

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type Recurring = typeof recurring.$inferSelect;
export type SavingsEntry = typeof savingsEntries.$inferSelect;
```

- [ ] **Step 2: Write a sanity test `server/__tests__/schema.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { accounts, transactions, savingsEntries } from "@shared/schema";

describe("schema", () => {
  it("exposes expected tables with key columns", () => {
    expect(accounts).toBeDefined();
    expect(transactions).toBeDefined();
    expect(savingsEntries).toBeDefined();
  });
});
```

- [ ] **Step 3: Run test**

Run: `npm test -- schema`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: add Drizzle database schema"
```

---

## Task 3: Money helpers (cents)

**Files:**
- Create: `server/lib/money.ts`
- Test: `server/__tests__/money.test.ts`

**Interfaces:**
- Produces: `toCents(v: string | number): number`, `fromCents(c: number): number`, `formatMXN(c: number): string`.

- [ ] **Step 1: Write failing test `server/__tests__/money.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { toCents, fromCents, formatMXN } from "../lib/money";

describe("money", () => {
  it("converts to cents", () => {
    expect(toCents("12.34")).toBe(1234);
    expect(toCents(5)).toBe(500);
    expect(toCents("0.1")).toBe(10);
  });
  it("converts from cents", () => {
    expect(fromCents(1234)).toBe(12.34);
  });
  it("formats MXN", () => {
    expect(formatMXN(123456)).toBe("$1,234.56");
  });
});
```

- [ ] **Step 2: Run test — expect FAIL** (`Cannot find module '../lib/money'`)

Run: `npm test -- money`

- [ ] **Step 3: Implement `server/lib/money.ts`**

```ts
export function toCents(v: string | number): number {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Math.round(n * 100);
}

export function fromCents(c: number): number {
  return c / 100;
}

export function formatMXN(c: number): string {
  return "$" + (c / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
```

- [ ] **Step 4: Run test — expect PASS**

Run: `npm test -- money`

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add money/cents helpers"
```

---

## Task 4: Quincena helpers

**Files:**
- Create: `server/lib/quincena.ts`
- Test: `server/__tests__/quincena.test.ts`

**Interfaces:**
- Produces:
  - `quincenaHalf(d: Date): 1 | 2` — 1 for days 1–15, else 2.
  - `quincenaKey(d: Date): { year: number; month: number; half: 1 | 2 }`.
  - `quincenaRange(year: number, month: number, half: 1 | 2): { start: string; end: string }` — ISO `YYYY-MM-DD` inclusive bounds (half 2 end = last day of month).
  - `quincenaLabel(year, month, half): string` — e.g. `"2026-07 Q1"`.

- [ ] **Step 1: Write failing test `server/__tests__/quincena.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { quincenaHalf, quincenaKey, quincenaRange } from "../lib/quincena";

describe("quincena", () => {
  it("classifies halves", () => {
    expect(quincenaHalf(new Date("2026-07-01"))).toBe(1);
    expect(quincenaHalf(new Date("2026-07-15"))).toBe(1);
    expect(quincenaHalf(new Date("2026-07-16"))).toBe(2);
    expect(quincenaHalf(new Date("2026-07-31"))).toBe(2);
  });
  it("builds key", () => {
    expect(quincenaKey(new Date("2026-07-20"))).toEqual({ year: 2026, month: 7, half: 2 });
  });
  it("computes ranges incl. month end", () => {
    expect(quincenaRange(2026, 7, 1)).toEqual({ start: "2026-07-01", end: "2026-07-15" });
    expect(quincenaRange(2026, 7, 2)).toEqual({ start: "2026-07-16", end: "2026-07-31" });
    expect(quincenaRange(2026, 2, 2)).toEqual({ start: "2026-02-16", end: "2026-02-28" });
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npm test -- quincena`

- [ ] **Step 3: Implement `server/lib/quincena.ts`**

```ts
export function quincenaHalf(d: Date): 1 | 2 {
  return d.getUTCDate() <= 15 ? 1 : 2;
}

export function quincenaKey(d: Date) {
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, half: quincenaHalf(d) };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function quincenaRange(year: number, month: number, half: 1 | 2) {
  if (half === 1) {
    return { start: `${year}-${pad(month)}-01`, end: `${year}-${pad(month)}-15` };
  }
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { start: `${year}-${pad(month)}-16`, end: `${year}-${pad(month)}-${pad(lastDay)}` };
}

export function quincenaLabel(year: number, month: number, half: 1 | 2): string {
  return `${year}-${pad(month)} Q${half}`;
}
```

- [ ] **Step 4: Run test — expect PASS**

Run: `npm test -- quincena`

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add quincena date helpers"
```

---

## Task 5: DB client & test harness

**Files:**
- Create: `server/db.ts`, `server/__tests__/helpers/testDb.ts`

**Interfaces:**
- Produces: `db` (Drizzle instance) and `pool` from `server/db.ts`. Test helper `makeTestDb()` returns an in-memory-ish Postgres connection using `DATABASE_URL` (a disposable test DB) and a `resetDb()` truncating all tables.

- [ ] **Step 1: Implement `server/db.ts`**

```ts
import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });
```

- [ ] **Step 2: Implement `server/__tests__/helpers/testDb.ts`**

```ts
import { pool, db } from "../../db";

export async function resetDb() {
  await pool.query(
    `TRUNCATE transactions, recurring, savings_entries, savings_goal, categories, accounts RESTART IDENTITY CASCADE`
  );
}

export { db, pool };
```

> Integration tests require a running Postgres and `DATABASE_URL` pointing at a **test** database with the schema pushed (`npm run db:push`). CI provisions this (Task 17).

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add Drizzle db client and test harness"
```

---

## Task 6: Zod validators

**Files:**
- Create: `shared/validators.ts`
- Test: `server/__tests__/validators.test.ts`

**Interfaces:**
- Produces: `accountInput`, `categoryInput`, `transactionInput`, `recurringInput`, `savingsEntryInput`, `savingsGoalInput`, `loginInput` — all Zod schemas validating client payloads (amounts as decimal strings/numbers, converted to cents in routes).

- [ ] **Step 1: Write failing test `server/__tests__/validators.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { accountInput, transactionInput } from "@shared/validators";

describe("validators", () => {
  it("accepts a valid account", () => {
    const r = accountInput.safeParse({ name: "Cash", type: "cash", startingBalance: 100 });
    expect(r.success).toBe(true);
  });
  it("rejects bad account type", () => {
    const r = accountInput.safeParse({ name: "X", type: "crypto" });
    expect(r.success).toBe(false);
  });
  it("rejects transaction with negative amount", () => {
    const r = transactionInput.safeParse({ date: "2026-07-01", amount: -5, accountId: 1, type: "expense" });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npm test -- validators`

- [ ] **Step 3: Implement `shared/validators.ts`**

```ts
import { z } from "zod";

const money = z.coerce.number().nonnegative();

export const accountInput = z.object({
  name: z.string().min(1),
  type: z.enum(["cash", "bank", "card", "savings"]),
  startingBalance: money.default(0),
  currency: z.string().default("MXN"),
});

export const categoryInput = z.object({
  name: z.string().min(1),
  type: z.enum(["expense", "income"]),
  monthlyBudget: money.nullish(),
});

export const transactionInput = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: money,
  accountId: z.number().int().positive(),
  categoryId: z.number().int().positive().nullish(),
  note: z.string().nullish(),
  type: z.enum(["expense", "income", "transfer"]),
});

export const recurringInput = z.object({
  name: z.string().min(1),
  amount: money,
  categoryId: z.number().int().positive().nullish(),
  accountId: z.number().int().positive(),
  frequency: z.enum(["weekly", "monthly"]),
  nextDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  active: z.boolean().default(true),
});

export const savingsEntryInput = z.object({
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
  quincenaHalf: z.union([z.literal(1), z.literal(2)]),
  amountSaved: money,
  goalOverride: money.nullish(),
  note: z.string().nullish(),
});

export const savingsGoalInput = z.object({
  quincenaTarget: money,
  overallGoal: money.nullish(),
});

export const loginInput = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
```

- [ ] **Step 4: Run — expect PASS**

Run: `npm test -- validators`

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add Zod input validators"
```

---

## Task 7: Auth (session + login + requireAuth)

**Files:**
- Create: `server/auth.ts`, `server/seed.ts`, `server/user.ts`
- Test: `server/__tests__/auth.test.ts`

**Interfaces:**
- Produces:
  - `buildSession()` — returns configured `express-session` middleware (pg-backed store).
  - `requireAuth(req, res, next)` — 401 JSON if `req.session.userId` missing.
  - `mountAuth(app)` — registers `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`.
  - `verifyCredentials(email, password): Promise<boolean>` in `server/user.ts` — compares against `SEED_EMAIL` + bcrypt hash of `SEED_PASSWORD`.
  - `server/seed.ts` — a script that ensures a default `savingsGoal` row exists.

- [ ] **Step 1: Write `server/user.ts`**

```ts
import bcrypt from "bcryptjs";

const email = process.env.SEED_EMAIL ?? "";
// Hash lazily so tests can set env before import side effects.
export async function verifyCredentials(inEmail: string, inPassword: string): Promise<boolean> {
  if (inEmail !== email) return false;
  const seed = process.env.SEED_PASSWORD ?? "";
  return inPassword === seed && seed.length > 0
    ? true
    : bcrypt.compareSync(inPassword, bcrypt.hashSync(seed, 8)) && inEmail === email;
}
```

> Simpler production form: store a pre-hashed `SEED_PASSWORD_HASH`. For v1 we compare plaintext env password directly (single user, secret env). Keep it minimal:

```ts
import bcrypt from "bcryptjs";
export async function verifyCredentials(inEmail: string, inPassword: string): Promise<boolean> {
  const email = process.env.SEED_EMAIL ?? "";
  const hash = process.env.SEED_PASSWORD_HASH
    ?? bcrypt.hashSync(process.env.SEED_PASSWORD ?? "", 8);
  if (inEmail !== email) return false;
  return bcrypt.compareSync(inPassword, hash);
}
```

Use the second (minimal) form. Add `SEED_PASSWORD_HASH` as optional in `.env.example`.

- [ ] **Step 2: Write `server/auth.ts`**

```ts
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import type { Express, RequestHandler } from "express";
import { pool } from "./db";
import { loginInput } from "@shared/validators";
import { verifyCredentials } from "./user";

declare module "express-session" {
  interface SessionData { userId?: string; }
}

export function buildSession(): RequestHandler {
  const PgStore = connectPgSimple(session);
  return session({
    store: new PgStore({ pool, createTableIfMissing: true }),
    secret: process.env.SESSION_SECRET ?? "dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 1000 * 60 * 60 * 24 * 30,
    },
  });
}

export const requireAuth: RequestHandler = (req, res, next) => {
  if (!req.session.userId) return res.status(401).json({ error: "unauthorized" });
  next();
};

export function mountAuth(app: Express) {
  app.post("/api/auth/login", async (req, res) => {
    const parsed = loginInput.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid" });
    const ok = await verifyCredentials(parsed.data.email, parsed.data.password);
    if (!ok) return res.status(401).json({ error: "bad credentials" });
    req.session.userId = parsed.data.email;
    res.json({ ok: true });
  });
  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
  });
  app.get("/api/auth/me", (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: "unauthorized" });
    res.json({ email: req.session.userId });
  });
}
```

- [ ] **Step 3: Write `server/seed.ts`**

```ts
import { db } from "./db";
import { savingsGoal } from "@shared/schema";

async function main() {
  const existing = await db.select().from(savingsGoal).limit(1);
  if (existing.length === 0) {
    await db.insert(savingsGoal).values({ quincenaTarget: 0 });
    console.log("seeded savings_goal");
  } else {
    console.log("savings_goal already present");
  }
  process.exit(0);
}
main();
```

- [ ] **Step 4: Write test `server/__tests__/auth.test.ts`** (uses the app factory from Task 8; if running Task 7 before 8, gate this test to import the built app). Minimal credential test that needs no DB:

```ts
import { describe, it, expect, beforeAll } from "vitest";
import bcrypt from "bcryptjs";

describe("verifyCredentials", () => {
  beforeAll(() => {
    process.env.SEED_EMAIL = "me@test.com";
    process.env.SEED_PASSWORD_HASH = bcrypt.hashSync("secret", 8);
  });
  it("accepts correct creds", async () => {
    const { verifyCredentials } = await import("../user");
    expect(await verifyCredentials("me@test.com", "secret")).toBe(true);
  });
  it("rejects wrong password", async () => {
    const { verifyCredentials } = await import("../user");
    expect(await verifyCredentials("me@test.com", "nope")).toBe(false);
  });
});
```

- [ ] **Step 5: Run — expect PASS**

Run: `npm test -- auth`

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: add session auth, login routes, seed script"
```

---

## Task 8: Express app factory + server bootstrap

**Files:**
- Create: `server/app.ts`, `server/index.ts`
- Test: `server/__tests__/app.test.ts`

**Interfaces:**
- Produces: `createApp(): Express` in `server/app.ts` — wires JSON body parsing, session, auth routes, resource routers (added in later tasks via `registerRoutes(app)` placeholder), and static client serving in production. `server/index.ts` calls `createApp().listen(PORT)`.

- [ ] **Step 1: Write `server/app.ts`**

```ts
import express, { type Express } from "express";
import path from "path";
import { fileURLToPath } from "url";
import { buildSession, mountAuth, requireAuth } from "./auth";

export function createApp(): Express {
  const app = express();
  app.use(express.json());
  app.use(buildSession());
  mountAuth(app);

  // Resource routers are mounted here in later tasks:
  // mountAccounts(app); mountCategories(app); ...

  app.get("/api/health", (_req, res) => res.json({ ok: true }));

  if (process.env.NODE_ENV === "production") {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const clientDir = path.join(__dirname, "client");
    app.use(express.static(clientDir));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api")) return next();
      res.sendFile(path.join(clientDir, "index.html"));
    });
  }
  return app;
}

export { requireAuth };
```

> Build note: `build:server` outputs `dist/server.js`; the Vite client builds to `dist/client`. In production `__dirname` is `dist`, so `path.join(__dirname, "client")` resolves to `dist/client`. Update `build:server` outfile is `dist/server.js` — matches.

- [ ] **Step 2: Write `server/index.ts`**

```ts
import "dotenv/config";
import { createApp } from "./app";

const port = Number(process.env.PORT ?? 5002);
createApp().listen(port, () => console.log(`Puerquito on :${port}`));
```

- [ ] **Step 3: Write test `server/__tests__/app.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../app";

describe("app", () => {
  it("health check works", async () => {
    const res = await request(createApp()).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
  it("protected route without session 401s", async () => {
    const res = await request(createApp()).get("/api/auth/me");
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 4: Run — expect PASS**

Run: `npm test -- app`

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add Express app factory and bootstrap"
```

---

## Task 9: Balance computation

**Files:**
- Create: `server/lib/balance.ts`
- Test: `server/__tests__/balance.test.ts`

**Interfaces:**
- Produces: `applyTxn(starting: number, txns: {amount:number; type:string}[]): number` — pure function: income adds, expense subtracts, transfer subtracts (money leaving this account). Returns cents.

- [ ] **Step 1: Write failing test `server/__tests__/balance.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { applyTxn } from "../lib/balance";

describe("balance", () => {
  it("adds income, subtracts expense/transfer", () => {
    const bal = applyTxn(10000, [
      { amount: 5000, type: "income" },
      { amount: 2000, type: "expense" },
      { amount: 1000, type: "transfer" },
    ]);
    expect(bal).toBe(12000);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement `server/lib/balance.ts`**

```ts
export function applyTxn(
  starting: number,
  txns: { amount: number; type: string }[]
): number {
  return txns.reduce((bal, t) => {
    if (t.type === "income") return bal + t.amount;
    return bal - t.amount; // expense or transfer
  }, starting);
}
```

- [ ] **Step 4: Run — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: add account balance computation"
```

---

## Task 10: Accounts API (template resource)

**Files:**
- Create: `server/routes/accounts.ts`
- Modify: `server/app.ts` (mount router)
- Test: `server/__tests__/accounts.int.test.ts`

**Interfaces:**
- Consumes: `db`, `requireAuth`, `accountInput`, `applyTxn`, `toCents`.
- Produces: `mountAccounts(app)` registering, all behind `requireAuth`:
  - `GET /api/accounts` → accounts with computed `balance` (cents).
  - `POST /api/accounts` → create.
  - `PATCH /api/accounts/:id` → update.
  - `DELETE /api/accounts/:id` → delete.

- [ ] **Step 1: Write integration test `server/__tests__/accounts.int.test.ts`**

```ts
import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import bcrypt from "bcryptjs";
import request from "supertest";
import { createApp } from "../app";
import { resetDb } from "./helpers/testDb";

const agent = () => request.agent(createApp());
async function login(a: ReturnType<typeof agent>) {
  await a.post("/api/auth/login").send({ email: "me@test.com", password: "secret" });
}

beforeAll(() => {
  process.env.SEED_EMAIL = "me@test.com";
  process.env.SEED_PASSWORD_HASH = bcrypt.hashSync("secret", 8);
});
beforeEach(async () => { await resetDb(); });

describe("accounts API", () => {
  it("requires auth", async () => {
    const res = await request(createApp()).get("/api/accounts");
    expect(res.status).toBe(401);
  });
  it("creates and lists with balance", async () => {
    const a = agent(); await login(a);
    const created = await a.post("/api/accounts").send({ name: "Cash", type: "cash", startingBalance: 100 });
    expect(created.status).toBe(200);
    const list = await a.get("/api/accounts");
    expect(list.body[0].name).toBe("Cash");
    expect(list.body[0].balance).toBe(10000); // 100.00 -> cents
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npm test -- accounts.int`
Expected: FAIL (route not mounted).

- [ ] **Step 3: Implement `server/routes/accounts.ts`**

```ts
import type { Express } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { accounts, transactions } from "@shared/schema";
import { accountInput } from "@shared/validators";
import { requireAuth } from "../auth";
import { toCents } from "../lib/money";
import { applyTxn } from "../lib/balance";

export function mountAccounts(app: Express) {
  app.get("/api/accounts", requireAuth, async (_req, res) => {
    const rows = await db.select().from(accounts);
    const txns = await db.select().from(transactions);
    const withBal = rows.map((a) => ({
      ...a,
      balance: applyTxn(
        a.startingBalance,
        txns.filter((t) => t.accountId === a.id)
      ),
    }));
    res.json(withBal);
  });

  app.post("/api/accounts", requireAuth, async (req, res) => {
    const p = accountInput.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: p.error.flatten() });
    const [row] = await db.insert(accounts).values({
      name: p.data.name, type: p.data.type,
      startingBalance: toCents(p.data.startingBalance),
      currency: p.data.currency,
    }).returning();
    res.json(row);
  });

  app.patch("/api/accounts/:id", requireAuth, async (req, res) => {
    const p = accountInput.partial().safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: p.error.flatten() });
    const patch: Record<string, unknown> = { ...p.data };
    if (p.data.startingBalance !== undefined) patch.startingBalance = toCents(p.data.startingBalance);
    const [row] = await db.update(accounts).set(patch)
      .where(eq(accounts.id, Number(req.params.id))).returning();
    if (!row) return res.status(404).json({ error: "not found" });
    res.json(row);
  });

  app.delete("/api/accounts/:id", requireAuth, async (req, res) => {
    await db.delete(accounts).where(eq(accounts.id, Number(req.params.id)));
    res.json({ ok: true });
  });
}
```

- [ ] **Step 4: Mount in `server/app.ts`** — add import and call:

```ts
import { mountAccounts } from "./routes/accounts";
// ...after mountAuth(app):
mountAccounts(app);
```

- [ ] **Step 5: Run — expect PASS** (requires test Postgres with schema pushed)

Run: `npm run db:push && npm test -- accounts.int`

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: add accounts API with computed balances"
```

---

## Task 11: Categories API

**Files:**
- Create: `server/routes/categories.ts`; Modify: `server/app.ts`
- Test: `server/__tests__/categories.int.test.ts`

**Interfaces:**
- Produces: `mountCategories(app)` — `GET/POST/PATCH/DELETE /api/categories`, all `requireAuth`. `monthlyBudget` stored in cents.

- [ ] **Step 1: Write test** mirroring the accounts test: create a category `{name:"Food", type:"expense", monthlyBudget: 300}`, assert `GET` returns it with `monthlyBudget === 30000`, and unauth GET → 401.

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

describe("categories API", () => {
  it("creates with cents budget", async () => {
    const a = request.agent(createApp());
    await a.post("/api/auth/login").send({ email: "me@test.com", password: "secret" });
    await a.post("/api/categories").send({ name: "Food", type: "expense", monthlyBudget: 300 });
    const list = await a.get("/api/categories");
    expect(list.body[0].monthlyBudget).toBe(30000);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement `server/routes/categories.ts`**

```ts
import type { Express } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { categories } from "@shared/schema";
import { categoryInput } from "@shared/validators";
import { requireAuth } from "../auth";
import { toCents } from "../lib/money";

export function mountCategories(app: Express) {
  app.get("/api/categories", requireAuth, async (_req, res) => {
    res.json(await db.select().from(categories));
  });
  app.post("/api/categories", requireAuth, async (req, res) => {
    const p = categoryInput.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: p.error.flatten() });
    const [row] = await db.insert(categories).values({
      name: p.data.name, type: p.data.type,
      monthlyBudget: p.data.monthlyBudget == null ? null : toCents(p.data.monthlyBudget),
    }).returning();
    res.json(row);
  });
  app.patch("/api/categories/:id", requireAuth, async (req, res) => {
    const p = categoryInput.partial().safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: p.error.flatten() });
    const patch: Record<string, unknown> = { ...p.data };
    if (p.data.monthlyBudget !== undefined && p.data.monthlyBudget !== null)
      patch.monthlyBudget = toCents(p.data.monthlyBudget);
    const [row] = await db.update(categories).set(patch)
      .where(eq(categories.id, Number(req.params.id))).returning();
    if (!row) return res.status(404).json({ error: "not found" });
    res.json(row);
  });
  app.delete("/api/categories/:id", requireAuth, async (req, res) => {
    await db.delete(categories).where(eq(categories.id, Number(req.params.id)));
    res.json({ ok: true });
  });
}
```

- [ ] **Step 4: Mount** in `server/app.ts`: `import { mountCategories } from "./routes/categories"; mountCategories(app);`

- [ ] **Step 5: Run — expect PASS**

Run: `npm test -- categories.int`

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: add categories API"
```

---

## Task 12: Transactions API

**Files:**
- Create: `server/routes/transactions.ts`; Modify: `server/app.ts`
- Test: `server/__tests__/transactions.int.test.ts`

**Interfaces:**
- Produces: `mountTransactions(app)`:
  - `GET /api/transactions?month=YYYY-MM&accountId=&categoryId=` → filtered list, newest first.
  - `POST /api/transactions`, `PATCH /api/transactions/:id`, `DELETE /api/transactions/:id`, all `requireAuth`. Amount stored in cents.

- [ ] **Step 1: Write test**: login, create an account, create an expense `{date:"2026-07-10", amount:12.5, accountId, type:"expense"}`, assert `GET /api/transactions?month=2026-07` returns 1 row with `amount===1250`, and `month=2026-08` returns 0.

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

describe("transactions API", () => {
  it("filters by month and stores cents", async () => {
    const a = request.agent(createApp());
    await a.post("/api/auth/login").send({ email: "me@test.com", password: "secret" });
    const acc = await a.post("/api/accounts").send({ name: "Cash", type: "cash" });
    await a.post("/api/transactions").send({ date: "2026-07-10", amount: 12.5, accountId: acc.body.id, type: "expense" });
    const jul = await a.get("/api/transactions?month=2026-07");
    expect(jul.body).toHaveLength(1);
    expect(jul.body[0].amount).toBe(1250);
    const aug = await a.get("/api/transactions?month=2026-08");
    expect(aug.body).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement `server/routes/transactions.ts`**

```ts
import type { Express } from "express";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "../db";
import { transactions } from "@shared/schema";
import { transactionInput } from "@shared/validators";
import { requireAuth } from "../auth";
import { toCents } from "../lib/money";

function monthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: `${month}-01`, end: `${month}-${String(last).padStart(2, "0")}` };
}

export function mountTransactions(app: Express) {
  app.get("/api/transactions", requireAuth, async (req, res) => {
    const conds = [];
    if (typeof req.query.month === "string") {
      const { start, end } = monthRange(req.query.month);
      conds.push(gte(transactions.date, start), lte(transactions.date, end));
    }
    if (req.query.accountId) conds.push(eq(transactions.accountId, Number(req.query.accountId)));
    if (req.query.categoryId) conds.push(eq(transactions.categoryId, Number(req.query.categoryId)));
    const rows = await db.select().from(transactions)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(transactions.date), desc(transactions.id));
    res.json(rows);
  });

  app.post("/api/transactions", requireAuth, async (req, res) => {
    const p = transactionInput.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: p.error.flatten() });
    const [row] = await db.insert(transactions).values({
      date: p.data.date, amount: toCents(p.data.amount),
      accountId: p.data.accountId, categoryId: p.data.categoryId ?? null,
      note: p.data.note ?? null, type: p.data.type,
    }).returning();
    res.json(row);
  });

  app.patch("/api/transactions/:id", requireAuth, async (req, res) => {
    const p = transactionInput.partial().safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: p.error.flatten() });
    const patch: Record<string, unknown> = { ...p.data };
    if (p.data.amount !== undefined) patch.amount = toCents(p.data.amount);
    const [row] = await db.update(transactions).set(patch)
      .where(eq(transactions.id, Number(req.params.id))).returning();
    if (!row) return res.status(404).json({ error: "not found" });
    res.json(row);
  });

  app.delete("/api/transactions/:id", requireAuth, async (req, res) => {
    await db.delete(transactions).where(eq(transactions.id, Number(req.params.id)));
    res.json({ ok: true });
  });
}
```

- [ ] **Step 4: Mount** in `server/app.ts`.

- [ ] **Step 5: Run — expect PASS**

Run: `npm test -- transactions.int`

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: add transactions API with month filter"
```

---

## Task 13: Recurring API + mark-paid

**Files:**
- Create: `server/routes/recurring.ts`; Modify: `server/app.ts`
- Test: `server/__tests__/recurring.int.test.ts`

**Interfaces:**
- Produces: `mountRecurring(app)`:
  - `GET/POST/PATCH/DELETE /api/recurring`.
  - `POST /api/recurring/:id/pay` → inserts a `transaction` (type `expense`) for the recurring's amount/account/category dated today, then advances `nextDueDate` by frequency (weekly=+7d, monthly=+1 month). Returns updated recurring.

- [ ] **Step 1: Write test**: create account, create monthly recurring due `2026-07-01`, call `/pay`, assert a transaction was created (`GET /api/transactions` length 1, amount matches) and recurring `nextDueDate` is `2026-08-01`.

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

describe("recurring pay", () => {
  it("creates a transaction and advances due date", async () => {
    const a = request.agent(createApp());
    await a.post("/api/auth/login").send({ email: "me@test.com", password: "secret" });
    const acc = await a.post("/api/accounts").send({ name: "Bank", type: "bank" });
    const rec = await a.post("/api/recurring").send({
      name: "Rent", amount: 500, accountId: acc.body.id,
      frequency: "monthly", nextDueDate: "2026-07-01",
    });
    const paid = await a.post(`/api/recurring/${rec.body.id}/pay`);
    expect(paid.body.nextDueDate).toBe("2026-08-01");
    const txns = await a.get("/api/transactions");
    expect(txns.body).toHaveLength(1);
    expect(txns.body[0].amount).toBe(50000);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement `server/routes/recurring.ts`**

```ts
import type { Express } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { recurring, transactions } from "@shared/schema";
import { recurringInput } from "@shared/validators";
import { requireAuth } from "../auth";
import { toCents } from "../lib/money";

function advance(dateStr: string, freq: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  if (freq === "weekly") d.setUTCDate(d.getUTCDate() + 7);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}

export function mountRecurring(app: Express) {
  app.get("/api/recurring", requireAuth, async (_req, res) => {
    res.json(await db.select().from(recurring));
  });
  app.post("/api/recurring", requireAuth, async (req, res) => {
    const p = recurringInput.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: p.error.flatten() });
    const [row] = await db.insert(recurring).values({
      name: p.data.name, amount: toCents(p.data.amount),
      categoryId: p.data.categoryId ?? null, accountId: p.data.accountId,
      frequency: p.data.frequency, nextDueDate: p.data.nextDueDate, active: p.data.active,
    }).returning();
    res.json(row);
  });
  app.patch("/api/recurring/:id", requireAuth, async (req, res) => {
    const p = recurringInput.partial().safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: p.error.flatten() });
    const patch: Record<string, unknown> = { ...p.data };
    if (p.data.amount !== undefined) patch.amount = toCents(p.data.amount);
    const [row] = await db.update(recurring).set(patch)
      .where(eq(recurring.id, Number(req.params.id))).returning();
    if (!row) return res.status(404).json({ error: "not found" });
    res.json(row);
  });
  app.delete("/api/recurring/:id", requireAuth, async (req, res) => {
    await db.delete(recurring).where(eq(recurring.id, Number(req.params.id)));
    res.json({ ok: true });
  });
  app.post("/api/recurring/:id/pay", requireAuth, async (req, res) => {
    const [rec] = await db.select().from(recurring).where(eq(recurring.id, Number(req.params.id)));
    if (!rec) return res.status(404).json({ error: "not found" });
    await db.insert(transactions).values({
      date: new Date().toISOString().slice(0, 10),
      amount: rec.amount, accountId: rec.accountId, categoryId: rec.categoryId,
      note: `Recurring: ${rec.name}`, type: "expense",
    });
    const [row] = await db.update(recurring)
      .set({ nextDueDate: advance(rec.nextDueDate, rec.frequency) })
      .where(eq(recurring.id, rec.id)).returning();
    res.json(row);
  });
}
```

- [ ] **Step 4: Mount** in `server/app.ts`.

- [ ] **Step 5: Run — expect PASS**

Run: `npm test -- recurring.int`

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: add recurring API with mark-paid"
```

---

## Task 14: Savings API (goal + quincena entries)

**Files:**
- Create: `server/routes/savings.ts`; Modify: `server/app.ts`
- Test: `server/__tests__/savings.int.test.ts`

**Interfaces:**
- Produces: `mountSavings(app)`:
  - `GET /api/savings/goal` / `PUT /api/savings/goal` → the single goal row (`quincenaTarget`, `overallGoal`).
  - `GET /api/savings/entries` → all entries ordered by year, month, half; each augmented with `goal` = `goalOverride ?? goal.quincenaTarget` and `total` = running cumulative sum.
  - `POST /api/savings/entries` (upsert by year+month+half) and `DELETE /api/savings/entries/:id`.

- [ ] **Step 1: Write test**: set goal `quincenaTarget:2000`; upsert entry `{year:2026,month:7,half:1,amountSaved:1800}`; GET entries → row has `goal===200000`, `amountSaved===180000`, `total===180000`; upsert same period again with `2500` → still one row, `amountSaved===250000`.

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

describe("savings API", () => {
  it("upserts entry and computes goal + running total", async () => {
    const a = request.agent(createApp());
    await a.post("/api/auth/login").send({ email: "me@test.com", password: "secret" });
    await a.put("/api/savings/goal").send({ quincenaTarget: 2000 });
    await a.post("/api/savings/entries").send({ year: 2026, month: 7, quincenaHalf: 1, amountSaved: 1800 });
    let list = await a.get("/api/savings/entries");
    expect(list.body).toHaveLength(1);
    expect(list.body[0].goal).toBe(200000);
    expect(list.body[0].total).toBe(180000);
    await a.post("/api/savings/entries").send({ year: 2026, month: 7, quincenaHalf: 1, amountSaved: 2500 });
    list = await a.get("/api/savings/entries");
    expect(list.body).toHaveLength(1);
    expect(list.body[0].amountSaved).toBe(250000);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

- [ ] **Step 3: Implement `server/routes/savings.ts`**

```ts
import type { Express } from "express";
import { and, asc, eq } from "drizzle-orm";
import { db } from "../db";
import { savingsGoal, savingsEntries } from "@shared/schema";
import { savingsEntryInput, savingsGoalInput } from "@shared/validators";
import { requireAuth } from "../auth";
import { toCents } from "../lib/money";

async function getGoalRow() {
  const rows = await db.select().from(savingsGoal).limit(1);
  if (rows.length) return rows[0];
  const [row] = await db.insert(savingsGoal).values({ quincenaTarget: 0 }).returning();
  return row;
}

export function mountSavings(app: Express) {
  app.get("/api/savings/goal", requireAuth, async (_req, res) => {
    res.json(await getGoalRow());
  });
  app.put("/api/savings/goal", requireAuth, async (req, res) => {
    const p = savingsGoalInput.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: p.error.flatten() });
    const goal = await getGoalRow();
    const [row] = await db.update(savingsGoal).set({
      quincenaTarget: toCents(p.data.quincenaTarget),
      overallGoal: p.data.overallGoal == null ? null : toCents(p.data.overallGoal),
    }).where(eq(savingsGoal.id, goal.id)).returning();
    res.json(row);
  });

  app.get("/api/savings/entries", requireAuth, async (_req, res) => {
    const goal = await getGoalRow();
    const rows = await db.select().from(savingsEntries)
      .orderBy(asc(savingsEntries.year), asc(savingsEntries.month), asc(savingsEntries.quincenaHalf));
    let running = 0;
    const out = rows.map((r) => {
      running += r.amountSaved;
      return { ...r, goal: r.goalOverride ?? goal.quincenaTarget, total: running };
    });
    res.json(out);
  });

  app.post("/api/savings/entries", requireAuth, async (req, res) => {
    const p = savingsEntryInput.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: p.error.flatten() });
    const d = p.data;
    const existing = await db.select().from(savingsEntries).where(and(
      eq(savingsEntries.year, d.year),
      eq(savingsEntries.month, d.month),
      eq(savingsEntries.quincenaHalf, d.quincenaHalf),
    ));
    const values = {
      year: d.year, month: d.month, quincenaHalf: d.quincenaHalf,
      amountSaved: toCents(d.amountSaved),
      goalOverride: d.goalOverride == null ? null : toCents(d.goalOverride),
      note: d.note ?? null,
    };
    let row;
    if (existing.length) {
      [row] = await db.update(savingsEntries).set(values)
        .where(eq(savingsEntries.id, existing[0].id)).returning();
    } else {
      [row] = await db.insert(savingsEntries).values(values).returning();
    }
    res.json(row);
  });

  app.delete("/api/savings/entries/:id", requireAuth, async (req, res) => {
    await db.delete(savingsEntries).where(eq(savingsEntries.id, Number(req.params.id)));
    res.json({ ok: true });
  });
}
```

- [ ] **Step 4: Mount** in `server/app.ts`.

- [ ] **Step 5: Run — expect PASS**

Run: `npm test -- savings.int`

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: add savings goal + quincena entries API"
```

---

## Task 15: Client scaffold (React, router, query, auth)

**Files:**
- Create: `client/index.html`, `client/src/main.tsx`, `client/src/api.ts`, `client/src/auth.tsx`, `client/src/App.tsx`, `client/src/styles.css`, `client/src/components/Layout.tsx`, `client/src/components/Money.tsx`

**Interfaces:**
- Produces:
  - `api(path, opts)` fetch wrapper (JSON, credentials: "include", throws on non-2xx).
  - `useAuth()` context with `{ email, login, logout, loading }`.
  - `<ProtectedRoute>` redirecting to `/login` when unauthenticated.
  - Router with routes for all 7 screens (pages are stubs until their tasks).
  - `<Money cents={n} />` renders formatted MXN.

- [ ] **Step 1: `client/index.html`**

```html
<!doctype html>
<html lang="es">
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>Puerquito 🐷</title></head>
  <body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body>
</html>
```

- [ ] **Step 2: `client/src/api.ts`**

```ts
export async function api<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    credentials: "include",
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
  return res.status === 204 ? (undefined as T) : res.json();
}
```

- [ ] **Step 3: `client/src/auth.tsx`**

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { api } from "./api";

type AuthCtx = { email: string | null; loading: boolean; login: (e: string, p: string) => Promise<void>; logout: () => Promise<void>; };
const Ctx = createContext<AuthCtx>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api("/api/auth/me").then((u: any) => setEmail(u.email)).catch(() => setEmail(null)).finally(() => setLoading(false));
  }, []);
  async function login(e: string, p: string) {
    await api("/api/auth/login", { method: "POST", body: JSON.stringify({ email: e, password: p }) });
    setEmail(e);
  }
  async function logout() { await api("/api/auth/logout", { method: "POST" }); setEmail(null); }
  return <Ctx.Provider value={{ email, loading, login, logout }}>{children}</Ctx.Provider>;
}
export const useAuth = () => useContext(Ctx);
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { email, loading } = useAuth();
  if (loading) return <div style={{ padding: 24 }}>Cargando…</div>;
  return email ? <>{children}</> : <Navigate to="/login" replace />;
}
```

- [ ] **Step 4: `client/src/components/Money.tsx`**

```tsx
export function Money({ cents }: { cents: number }) {
  return <span>${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>;
}
```

- [ ] **Step 5: `client/src/components/Layout.tsx`**

```tsx
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth";

const links = [
  ["/", "Dashboard"], ["/transactions", "Movimientos"], ["/budgets", "Presupuestos"],
  ["/accounts", "Cuentas"], ["/recurring", "Recurrentes"], ["/ahorro", "Ahorro"],
];
export function Layout() {
  const { logout } = useAuth();
  return (
    <div className="layout">
      <nav className="sidebar">
        <h1>Puerquito 🐷</h1>
        {links.map(([to, label]) => (
          <NavLink key={to} to={to} end={to === "/"}>{label}</NavLink>
        ))}
        <button onClick={logout} className="logout">Salir</button>
      </nav>
      <main className="content"><Outlet /></main>
    </div>
  );
}
```

- [ ] **Step 6: `client/src/App.tsx`** (page imports are added as each page task lands; stub missing ones with a placeholder component now)

```tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, ProtectedRoute } from "./auth";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Transactions } from "./pages/Transactions";
import { Budgets } from "./pages/Budgets";
import { Accounts } from "./pages/Accounts";
import { Recurring } from "./pages/Recurring";
import { Ahorro } from "./pages/Ahorro";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/budgets" element={<Budgets />} />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/recurring" element={<Recurring />} />
            <Route path="/ahorro" element={<Ahorro />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
```

- [ ] **Step 7: `client/src/main.tsx`**

```tsx
import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./styles.css";

const qc = new QueryClient();
createRoot(document.getElementById("root")!).render(
  <React.StrictMode><QueryClientProvider client={qc}><App /></QueryClientProvider></React.StrictMode>
);
```

- [ ] **Step 8: `client/src/styles.css`** — minimal readable layout (sidebar + content, cards, tables). Keep it clean; a distinct visual pass happens in Task 22.

```css
* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, sans-serif; background: #f6f7f9; color: #1a1a1a; }
.layout { display: flex; min-height: 100vh; }
.sidebar { width: 210px; background: #fff; border-right: 1px solid #e5e7eb; padding: 16px; display: flex; flex-direction: column; gap: 6px; }
.sidebar h1 { font-size: 18px; }
.sidebar a { padding: 8px 10px; border-radius: 8px; text-decoration: none; color: #374151; }
.sidebar a.active { background: #eef2ff; color: #4338ca; font-weight: 600; }
.logout { margin-top: auto; padding: 8px; border: 0; background: #f3f4f6; border-radius: 8px; cursor: pointer; }
.content { flex: 1; padding: 24px; }
.card { background: #fff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; margin-bottom: 16px; }
table { width: 100%; border-collapse: collapse; }
th, td { text-align: left; padding: 8px; border-bottom: 1px solid #f0f0f0; }
input, select, button { padding: 8px; border-radius: 8px; border: 1px solid #d1d5db; }
.bar { height: 10px; background: #eee; border-radius: 6px; overflow: hidden; }
.bar > span { display: block; height: 100%; background: #4338ca; }
.over > span { background: #dc2626; }
```

- [ ] **Step 9: Create placeholder page files** so the client builds. For each of `client/src/pages/{Login,Dashboard,Transactions,Budgets,Accounts,Recurring,Ahorro}.tsx` create a stub:

```tsx
export function Dashboard() { return <div className="card">Pronto…</div>; }
```

(name the export to match: `Login`, `Transactions`, etc. `Login` will be replaced in Task 16.)

- [ ] **Step 10: Verify client builds**

Run: `npm run build:client`
Expected: build succeeds, outputs `dist/client`.

- [ ] **Step 11: Commit**

```bash
git add -A && git commit -m "feat: scaffold React client, router, auth context"
```

---

## Task 16: Login page

**Files:**
- Modify: `client/src/pages/Login.tsx`

**Interfaces:**
- Consumes: `useAuth().login`. Produces: `Login` component; on success navigates to `/`.

- [ ] **Step 1: Implement `client/src/pages/Login.tsx`**

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

export function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try { await login(email, password); nav("/"); }
    catch { setErr("Credenciales incorrectas"); }
  }
  return (
    <div style={{ maxWidth: 320, margin: "80px auto" }}>
      <div className="card">
        <h1>Puerquito 🐷</h1>
        <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
          <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input placeholder="Contraseña" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {err && <div style={{ color: "#dc2626" }}>{err}</div>}
          <button type="submit">Entrar</button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build check**

Run: `npm run build:client`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: add login page"
```

---

## Task 17: CI — tests on pull request

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Produces: GitHub Actions workflow running `npm ci`, pushing schema to a Postgres service, and `npm test` on every push/PR.

- [ ] **Step 1: Write `.github/workflows/ci.yml`**

```yaml
name: CI
on:
  push: { branches: [main] }
  pull_request:
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: puerquito
          POSTGRES_PASSWORD: puerquito
          POSTGRES_DB: puerquito_test
        ports: ["5432:5432"]
        options: >-
          --health-cmd "pg_isready -U puerquito"
          --health-interval 10s --health-timeout 5s --health-retries 5
    env:
      DATABASE_URL: postgres://puerquito:puerquito@localhost:5432/puerquito_test
      SEED_EMAIL: me@test.com
      SESSION_SECRET: test-secret
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run db:push
      - run: npm test
      - run: npm run build
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "ci: run tests and build on push/PR"
```

---

## Task 18: Deploy — systemd service & env example

**Files:**
- Create: `deploy/puerquito.service`
- Modify: `.env.example` (add `SEED_PASSWORD_HASH`)

**Interfaces:**
- Produces: systemd unit running `node dist/server.js` on port 5002 as the app service `puerquito`.

- [ ] **Step 1: Write `deploy/puerquito.service`**

```ini
[Unit]
Description=Puerquito personal finance app
After=network.target postgresql.service

[Service]
Type=simple
WorkingDirectory=/root/apps/puerquito/Puerquito
EnvironmentFile=/root/apps/puerquito/Puerquito/.env
ExecStart=/usr/bin/node dist/server.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

- [ ] **Step 2: Add hash var to `.env.example`**

```
# Preferred over SEED_PASSWORD: bcrypt hash of your password.
# Generate: node -e "console.log(require('bcryptjs').hashSync('yourpass',10))"
SEED_PASSWORD_HASH=
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "deploy: add systemd service and env template"
```

---

## Task 19: Deploy — nginx config & docs

**Files:**
- Create: `deploy/nginx-puerquito.conf`, `deploy/DEPLOY.md`

**Interfaces:**
- Produces: an nginx server block proxying the app's domain to `127.0.0.1:5002`, plus step-by-step server setup docs (reuses the `add-nginx-location` skill pattern but as a standalone domain vhost).

- [ ] **Step 1: Write `deploy/nginx-puerquito.conf`**

```nginx
server {
    server_name YOUR_DOMAIN www.YOUR_DOMAIN;
    location / {
        proxy_pass http://127.0.0.1:5002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    listen 80;
}
```

- [ ] **Step 2: Write `deploy/DEPLOY.md`** — one-time server setup:

````markdown
# Puerquito server setup (one time)

1. **DNS:** point `YOUR_DOMAIN` A record → `5.78.198.194`.

2. **Postgres:**
   ```bash
   sudo -u postgres psql -c "CREATE USER puerquito WITH PASSWORD 'STRONGPASS';"
   sudo -u postgres psql -c "CREATE DATABASE puerquito OWNER puerquito;"
   ```

3. **Clone + build:**
   ```bash
   mkdir -p /root/apps/puerquito && cd /root/apps/puerquito
   git clone git@github.com:USER/Puerquito.git Puerquito && cd Puerquito
   npm ci
   ```

4. **.env** (create manually, never committed):
   ```
   DATABASE_URL=postgres://puerquito:STRONGPASS@localhost:5432/puerquito
   SESSION_SECRET=$(openssl rand -hex 32)
   SEED_EMAIL=you@example.com
   SEED_PASSWORD_HASH=<bcrypt hash>
   PORT=5002
   NODE_ENV=production
   ```

5. **Migrate + seed + build:**
   ```bash
   npm run db:push && npm run db:seed && npm run build
   ```

6. **systemd:**
   ```bash
   cp deploy/puerquito.service /etc/systemd/system/
   systemctl daemon-reload && systemctl enable --now puerquito
   ```

7. **nginx + SSL:**
   ```bash
   cp deploy/nginx-puerquito.conf /etc/nginx/sites-available/puerquito
   sed -i "s/YOUR_DOMAIN/yourdomain.com/g" /etc/nginx/sites-available/puerquito
   ln -s /etc/nginx/sites-available/puerquito /etc/nginx/sites-enabled/
   nginx -t && systemctl reload nginx
   certbot --nginx -d yourdomain.com -d www.yourdomain.com
   ```

8. **GitHub Secrets** (repo settings): `SSH_HOST=5.78.198.194`, `SSH_USER=root`,
   `SSH_PRIVATE_KEY=<deploy key>`.
````

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "deploy: add nginx vhost and server setup docs"
```

---

## Task 20: CD — auto-deploy on push to main

**Files:**
- Create: `.github/workflows/deploy.yml`

**Interfaces:**
- Produces: workflow that, after CI passes on `main`, SSHes to the VPS, pulls, installs, builds, and restarts the service (matches EMporium deploy pattern).

- [ ] **Step 1: Write `.github/workflows/deploy.yml`**

```yaml
name: Deploy
on:
  push: { branches: [main] }
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy over SSH
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.SSH_HOST }}
          username: ${{ secrets.SSH_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /root/apps/puerquito/Puerquito
            git pull origin main
            npm ci
            npm run db:push
            npm run build
            systemctl restart puerquito
```

- [ ] **Step 2: Commit**

```bash
git add -A && git commit -m "cd: auto-deploy to VPS on push to main"
```

---

## Task 21: Dashboard, Accounts, Transactions, Budgets, Recurring, Ahorro pages

> These pages consume the finished API. Each is an independently testable deliverable; implement and commit one at a time. Data fetching uses TanStack Query via the `api` helper.

**Files:**
- Modify: `client/src/pages/Accounts.tsx`, `Transactions.tsx`, `Budgets.tsx`, `Recurring.tsx`, `Ahorro.tsx`, `Dashboard.tsx`
- Create: `client/src/hooks.ts` (shared query hooks)

**Interfaces:**
- Consumes: `/api/accounts`, `/api/categories`, `/api/transactions`, `/api/recurring`, `/api/savings/*`.
- Produces: shared hooks `useAccounts()`, `useCategories()`, `useTransactions(month)`, `useRecurring()`, `useSavings()` and a generic `useMutate(path, method)` that invalidates queries.

- [ ] **Step 1: Create `client/src/hooks.ts`**

```ts
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";

export const useAccounts = () => useQuery({ queryKey: ["accounts"], queryFn: () => api("/api/accounts") });
export const useCategories = () => useQuery({ queryKey: ["categories"], queryFn: () => api("/api/categories") });
export const useTransactions = (month: string) =>
  useQuery({ queryKey: ["transactions", month], queryFn: () => api(`/api/transactions?month=${month}`) });
export const useRecurring = () => useQuery({ queryKey: ["recurring"], queryFn: () => api("/api/recurring") });
export const useSavings = () => useQuery({ queryKey: ["savings"], queryFn: () => api("/api/savings/entries") });
export const useGoal = () => useQuery({ queryKey: ["goal"], queryFn: () => api("/api/savings/goal") });

export function useMutate(invalidate: string[]) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ path, method, body }: { path: string; method: string; body?: any }) =>
      api(path, { method, body: body ? JSON.stringify(body) : undefined }),
    onSuccess: () => invalidate.forEach((k) => qc.invalidateQueries({ queryKey: [k] })),
  });
}
```

- [ ] **Step 2: Implement `Accounts.tsx`** — list accounts with `<Money>` balances + add form. Commit.

```tsx
import { useState } from "react";
import { useAccounts, useMutate } from "../hooks";
import { Money } from "../components/Money";

export function Accounts() {
  const { data: accounts = [] } = useAccounts();
  const m = useMutate(["accounts"]);
  const [name, setName] = useState(""); const [type, setType] = useState("cash"); const [start, setStart] = useState("0");
  return (
    <div>
      <h2>Cuentas</h2>
      <div className="card">
        {accounts.map((a: any) => (
          <div key={a.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0" }}>
            <span>{a.name} <small>({a.type})</small></span><strong><Money cents={a.balance} /></strong>
          </div>
        ))}
      </div>
      <div className="card">
        <h3>Nueva cuenta</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="cash">Efectivo</option><option value="bank">Banco</option>
            <option value="card">Tarjeta</option><option value="savings">Ahorro</option>
          </select>
          <input type="number" value={start} onChange={(e) => setStart(e.target.value)} />
          <button onClick={() => name && m.mutate({ path: "/api/accounts", method: "POST", body: { name, type, startingBalance: Number(start) } })}>Agregar</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Implement `Transactions.tsx`** — month selector, list, quick-add form (date, amount, account, category, type, note), delete button. Uses `useTransactions(month)`, `useAccounts`, `useCategories`, `useMutate(["transactions","accounts"])`. Commit.

- [ ] **Step 4: Implement `Budgets.tsx`** — for current month, per expense category with `monthlyBudget`, compute spent from `useTransactions(month)`, render a `.bar` (add `.over` class when spent > budget). Commit.

- [ ] **Step 5: Implement `Recurring.tsx`** — list recurring with next due date, "Pagar" button → `POST /api/recurring/:id/pay` via `useMutate(["recurring","transactions","accounts"])`, plus add form. Commit.

- [ ] **Step 6: Implement `Ahorro.tsx`** — goal editor (`quincenaTarget`, `overallGoal` via `PUT /api/savings/goal`), a form to enter a quincena's `amountSaved` (year/month/half picker defaulting to current quincena), a table of entries showing amount vs goal and running `total`, and a Recharts `LineChart` of `total` over quincenas. Commit.

```tsx
import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useSavings, useGoal, useMutate } from "../hooks";
import { Money } from "../components/Money";

export function Ahorro() {
  const { data: entries = [] } = useSavings();
  const { data: goal } = useGoal();
  const m = useMutate(["savings", "goal"]);
  const now = new Date();
  const [amount, setAmount] = useState("");
  const [half, setHalf] = useState(now.getUTCDate() <= 15 ? 1 : 2);
  const chart = entries.map((e: any) => ({ name: `${e.year}-${String(e.month).padStart(2, "0")} Q${e.quincenaHalf}`, total: e.total / 100 }));
  return (
    <div>
      <h2>Ahorro 🐷</h2>
      <div className="card">
        <h3>Meta por quincena</h3>
        <input type="number" defaultValue={goal ? goal.quincenaTarget / 100 : 0}
          onBlur={(e) => m.mutate({ path: "/api/savings/goal", method: "PUT", body: { quincenaTarget: Number(e.target.value), overallGoal: goal?.overallGoal ? goal.overallGoal / 100 : null } })} />
      </div>
      <div className="card">
        <h3>Registrar quincena</h3>
        <div style={{ display: "flex", gap: 8 }}>
          <select value={half} onChange={(e) => setHalf(Number(e.target.value))}>
            <option value={1}>1ª (1–15)</option><option value={2}>2ª (16–fin)</option>
          </select>
          <input type="number" placeholder="Ahorrado" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <button onClick={() => m.mutate({ path: "/api/savings/entries", method: "POST", body: { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1, quincenaHalf: half, amountSaved: Number(amount) } })}>Guardar</button>
        </div>
      </div>
      <div className="card">
        <h3>Progreso</h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chart}><XAxis dataKey="name" /><YAxis /><Tooltip /><Line dataKey="total" stroke="#4338ca" /></LineChart>
        </ResponsiveContainer>
        <table><thead><tr><th>Quincena</th><th>Ahorrado</th><th>Meta</th><th>Total</th></tr></thead>
          <tbody>{entries.map((e: any) => (
            <tr key={e.id}><td>{e.year}-{String(e.month).padStart(2, "0")} Q{e.quincenaHalf}</td>
              <td><Money cents={e.amountSaved} /></td><td><Money cents={e.goal} /></td><td><Money cents={e.total} /></td></tr>
          ))}</tbody></table>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Implement `Dashboard.tsx`** — net worth (sum of account balances), this-quincena saved vs goal, upcoming recurring (next 3 by due date), recent transactions (latest 5 this month). Commit.

- [ ] **Step 8: Final build check**

Run: `npm run build`
Expected: client + server build succeed.

- [ ] **Step 9: Commit any remaining**

```bash
git add -A && git commit -m "feat: implement all app pages"
```

---

## Task 22: Visual polish pass

**Files:**
- Modify: `client/src/styles.css` (and page markup as needed)

**Interfaces:** none new — purely presentational.

- [ ] **Step 1:** Invoke the `frontend-design` skill for a distinctive, intentional look (piggy-bank pink/indigo palette, good typography, card shadows, responsive sidebar). Apply refinements to `styles.css`.
- [ ] **Step 2:** `npm run build` — expect PASS.
- [ ] **Step 3:** Commit `style: visual polish pass`.

---

## Task 23: End-to-end smoke & first deploy

**Files:** none (operational).

- [ ] **Step 1:** Locally: create test DB, `npm run db:push && npm run db:seed`, set `.env`, `npm run build && npm start`, open `http://localhost:5002`, log in, exercise each screen.
- [ ] **Step 2:** Follow `deploy/DEPLOY.md` on the VPS for the one-time setup (DNS, Postgres, .env, systemd, nginx, certbot, GitHub Secrets).
- [ ] **Step 3:** Push to `main`; confirm GitHub Actions `Deploy` succeeds and the site is live over HTTPS on the new domain.
- [ ] **Step 4:** Verify login works in production and data persists.

---

## Self-Review

**Spec coverage:**
- Hosting/own domain → Tasks 18–20, 23. ✓
- Own port 5002 / systemd / nginx / GitHub Actions → 18–20. ✓
- Own Postgres DB + .env not committed → 19 (DEPLOY.md), Task 1 `.gitignore`. ✓
- Stack (Express+TS, React+Vite, Drizzle/Postgres) → 1, 8, 15. ✓
- Auth single user, bcrypt, session cookie, no signup → 7. ✓
- Data model (accounts, categories, transactions, recurring, savings_goal, savings_entries) → 2. ✓
- Computed balances → 9, 10. ✓
- Quincena logic (halves, goal per quincena, actual vs goal, editable) → 4, 14, 21(Ahorro). ✓
- Screens 1–7 → 16 (Login), 21 (all others). ✓
- MXN default, cents storage → Global Constraints, 3, throughout. ✓
- Editable everything (PATCH/DELETE) → 10–14. ✓
- Testing (money, quincena, balance, validators, API integration) → 3,4,6,9,10–14. ✓
- CI/CD + deploy at end → 17, 20, 23. ✓
- Out-of-scope items excluded. ✓

**Placeholder scan:** Page tasks 21 steps 3–5,7 describe pages in prose but each references exact endpoints, exact hooks, and concrete UI elements; the non-obvious ones (Accounts, Ahorro) include full code as templates. Acceptable — the pattern is fully shown twice and endpoints/props are exact. No TBD/TODO remain in code.

**Type consistency:** `mountX(app)` naming consistent across routes; `toCents`/`fromCents`/`formatMXN`, `applyTxn`, `quincenaHalf/Key/Range/Label`, `verifyCredentials`, `requireAuth`, `createApp`, hook names — all used consistently between definition and consumption. Amounts are cents end-to-end; client forms send decimal numbers, routes call `toCents`. ✓
