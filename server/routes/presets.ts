import type { Express } from "express";
import { asc, eq } from "drizzle-orm";
import { db } from "../db";
import { presets, transactions } from "@shared/schema";
import { presetInput } from "@shared/validators";
import { requireAuth } from "../auth";
import { toCents } from "../lib/money";

export function mountPresets(app: Express) {
  app.get("/api/presets", requireAuth, async (_req, res) => {
    res.json(await db.select().from(presets).orderBy(asc(presets.sort), asc(presets.id)));
  });

  app.post("/api/presets", requireAuth, async (req, res) => {
    const p = presetInput.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: p.error.flatten() });
    const [row] = await db.insert(presets).values({
      label: p.data.label,
      amount: toCents(p.data.amount),
      type: p.data.type,
      accountId: p.data.accountId,
      categoryId: p.data.categoryId ?? null,
      sort: p.data.sort,
    }).returning();
    res.json(row);
  });

  app.patch("/api/presets/:id", requireAuth, async (req, res) => {
    const p = presetInput.partial().safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: p.error.flatten() });
    const patch: Record<string, unknown> = { ...p.data };
    if (p.data.amount !== undefined) patch.amount = toCents(p.data.amount);
    const [row] = await db.update(presets).set(patch)
      .where(eq(presets.id, Number(req.params.id))).returning();
    if (!row) return res.status(404).json({ error: "not found" });
    res.json(row);
  });

  app.delete("/api/presets/:id", requireAuth, async (req, res) => {
    await db.delete(presets).where(eq(presets.id, Number(req.params.id)));
    res.json({ ok: true });
  });

  // One tap: log this preset as a transaction dated today.
  app.post("/api/presets/:id/log", requireAuth, async (req, res) => {
    const [preset] = await db.select().from(presets).where(eq(presets.id, Number(req.params.id)));
    if (!preset) return res.status(404).json({ error: "not found" });
    const [row] = await db.insert(transactions).values({
      date: new Date().toISOString().slice(0, 10),
      name: preset.label,
      amount: preset.amount,
      accountId: preset.accountId,
      categoryId: preset.categoryId,
      note: preset.label,
      type: preset.type,
    }).returning();
    res.json(row);
  });
}
