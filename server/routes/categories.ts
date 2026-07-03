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
      name: p.data.name,
      type: p.data.type,
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
