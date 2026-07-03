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
      name: p.data.name,
      amount: toCents(p.data.amount),
      categoryId: p.data.categoryId ?? null,
      accountId: p.data.accountId,
      frequency: p.data.frequency,
      nextDueDate: p.data.nextDueDate,
      active: p.data.active,
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
      amount: rec.amount,
      accountId: rec.accountId,
      categoryId: rec.categoryId,
      note: `Recurring: ${rec.name}`,
      type: "expense",
    });
    const [row] = await db.update(recurring)
      .set({ nextDueDate: advance(rec.nextDueDate, rec.frequency) })
      .where(eq(recurring.id, rec.id)).returning();
    res.json(row);
  });
}
