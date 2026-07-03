import type { Express } from "express";
import { asc, eq } from "drizzle-orm";
import { db } from "../db";
import { goals } from "@shared/schema";
import { goalInput, contributeInput } from "@shared/validators";
import { requireAuth } from "../auth";
import { toCents } from "../lib/money";

export function mountGoals(app: Express) {
  app.get("/api/goals", requireAuth, async (_req, res) => {
    res.json(await db.select().from(goals).orderBy(asc(goals.id)));
  });

  app.post("/api/goals", requireAuth, async (req, res) => {
    const p = goalInput.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: p.error.flatten() });
    const [row] = await db.insert(goals).values({
      name: p.data.name,
      monthlyAmount: toCents(p.data.monthlyAmount),
      targetAmount: p.data.targetAmount == null ? null : toCents(p.data.targetAmount),
    }).returning();
    res.json(row);
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
    res.json(row);
  });

  app.delete("/api/goals/:id", requireAuth, async (req, res) => {
    await db.delete(goals).where(eq(goals.id, Number(req.params.id)));
    res.json({ ok: true });
  });

  // Add money toward a goal (or subtract with a negative-adjusted call handled client-side).
  app.post("/api/goals/:id/contribute", requireAuth, async (req, res) => {
    const p = contributeInput.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: p.error.flatten() });
    const [goal] = await db.select().from(goals).where(eq(goals.id, Number(req.params.id)));
    if (!goal) return res.status(404).json({ error: "not found" });
    const [row] = await db.update(goals)
      .set({ saved: Math.max(0, goal.saved + toCents(p.data.amount)) })
      .where(eq(goals.id, goal.id)).returning();
    res.json(row);
  });
}
