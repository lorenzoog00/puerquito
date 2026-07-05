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
