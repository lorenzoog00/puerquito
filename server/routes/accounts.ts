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
      name: p.data.name,
      type: p.data.type,
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
