import type { Express } from "express";
import { and, asc, eq } from "drizzle-orm";
import { db } from "../db";
import { goals, goalContributions } from "@shared/schema";
import { goalInput, contributeInput } from "@shared/validators";
import { requireAuth } from "../auth";
import { toCents } from "../lib/money";
import { createSavingsTransfer, deleteTransfer } from "../lib/savingsTxn";

function ym(req: any) {
  const now = new Date();
  const year = Number(req.body?.year ?? req.query?.year ?? now.getUTCFullYear());
  const month = Number(req.body?.month ?? req.query?.month ?? now.getUTCMonth() + 1);
  return { year, month };
}

// Recompute goal.saved as the sum of its contributions (clamped >= 0).
async function recompute(goalId: number) {
  const rows = await db.select().from(goalContributions).where(eq(goalContributions.goalId, goalId));
  const sum = rows.reduce((s, r) => s + r.amount, 0);
  await db.update(goals).set({ saved: Math.max(0, sum) }).where(eq(goals.id, goalId));
}

// Attach the distinct "YYYY-MM" months a goal has a positive contribution in.
async function withMonths(goal: any) {
  const rows = await db.select().from(goalContributions)
    .where(eq(goalContributions.goalId, goal.id))
    .orderBy(asc(goalContributions.year), asc(goalContributions.month));
  const set = new Set<string>();
  for (const r of rows) if (r.amount > 0) set.add(`${r.year}-${String(r.month).padStart(2, "0")}`);
  return { ...goal, contributedMonths: [...set] };
}

async function monthRows(goalId: number, year: number, month: number) {
  return db.select().from(goalContributions).where(and(
    eq(goalContributions.goalId, goalId),
    eq(goalContributions.year, year),
    eq(goalContributions.month, month),
  ));
}

async function returnGoal(res: any, id: number) {
  const [updated] = await db.select().from(goals).where(eq(goals.id, id));
  res.json(await withMonths(updated));
}

export function mountGoals(app: Express) {
  app.get("/api/goals", requireAuth, async (_req, res) => {
    const rows = await db.select().from(goals).orderBy(asc(goals.id));
    res.json(await Promise.all(rows.map(withMonths)));
  });

  app.post("/api/goals", requireAuth, async (req, res) => {
    const p = goalInput.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: p.error.flatten() });
    const [row] = await db.insert(goals).values({
      name: p.data.name,
      monthlyAmount: toCents(p.data.monthlyAmount),
      targetAmount: p.data.targetAmount == null ? null : toCents(p.data.targetAmount),
    }).returning();
    res.json(await withMonths(row));
  });

  app.patch("/api/goals/:id", requireAuth, async (req, res) => {
    const p = goalInput.partial().safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: p.error.flatten() });
    const patch: Record<string, unknown> = { ...p.data };
    if (p.data.monthlyAmount !== undefined) patch.monthlyAmount = toCents(p.data.monthlyAmount);
    if (p.data.targetAmount !== undefined && p.data.targetAmount !== null)
      patch.targetAmount = toCents(p.data.targetAmount);
    const [row] = await db.update(goals).set(patch)
      .where(eq(goals.id, Number(req.params.id))).returning();
    if (!row) return res.status(404).json({ error: "not found" });
    res.json(await withMonths(row));
  });

  app.delete("/api/goals/:id", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const rows = await db.select().from(goalContributions).where(eq(goalContributions.goalId, id));
    for (const r of rows) await deleteTransfer(r.txnId);
    await db.delete(goalContributions).where(eq(goalContributions.goalId, id));
    await db.delete(goals).where(eq(goals.id, id));
    res.json({ ok: true });
  });

  // Manual deposit of an arbitrary amount (records a contribution + moves money out of Débito).
  app.post("/api/goals/:id/contribute", requireAuth, async (req, res) => {
    const p = contributeInput.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: p.error.flatten() });
    const id = Number(req.params.id);
    const [goal] = await db.select().from(goals).where(eq(goals.id, id));
    if (!goal) return res.status(404).json({ error: "not found" });
    const { year, month } = ym(req);
    const cents = toCents(p.data.amount);
    const txnId = await createSavingsTransfer(cents, `Abono: ${goal.name}`);
    await db.insert(goalContributions).values({ goalId: id, year, month, amount: cents, txnId });
    await recompute(id);
    await returnGoal(res, id);
  });

  // Check off this month: contribute the monthly amount (idempotent per month).
  app.post("/api/goals/:id/check", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const [goal] = await db.select().from(goals).where(eq(goals.id, id));
    if (!goal) return res.status(404).json({ error: "not found" });
    const { year, month } = ym(req);
    const existing = await monthRows(id, year, month);
    if (existing.length === 0) {
      const txnId = await createSavingsTransfer(goal.monthlyAmount, `Abono: ${goal.name}`);
      await db.insert(goalContributions).values({ goalId: id, year, month, amount: goal.monthlyAmount, txnId });
      await recompute(id);
    }
    await returnGoal(res, id);
  });

  // Uncheck this month: remove the month's contributions and their linked transfers.
  app.delete("/api/goals/:id/check", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const { year, month } = ym(req);
    const rows = await monthRows(id, year, month);
    for (const r of rows) await deleteTransfer(r.txnId);
    await db.delete(goalContributions).where(and(
      eq(goalContributions.goalId, id),
      eq(goalContributions.year, year),
      eq(goalContributions.month, month),
    ));
    await recompute(id);
    const [updated] = await db.select().from(goals).where(eq(goals.id, id));
    if (!updated) return res.status(404).json({ error: "not found" });
    res.json(await withMonths(updated));
  });
}
