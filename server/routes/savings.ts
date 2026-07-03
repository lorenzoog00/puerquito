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
      year: d.year,
      month: d.month,
      quincenaHalf: d.quincenaHalf,
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
