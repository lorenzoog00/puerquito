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
      date: p.data.date,
      amount: toCents(p.data.amount),
      accountId: p.data.accountId,
      categoryId: p.data.categoryId ?? null,
      note: p.data.note ?? null,
      type: p.data.type,
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
