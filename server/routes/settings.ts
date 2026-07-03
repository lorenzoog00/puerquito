import type { Express } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { settings } from "@shared/schema";
import { settingsInput } from "@shared/validators";
import { requireAuth } from "../auth";

async function getSettingsRow() {
  const rows = await db.select().from(settings).limit(1);
  if (rows.length) return rows[0];
  const [row] = await db.insert(settings).values({ ownerName: null }).returning();
  return row;
}

export function mountSettings(app: Express) {
  app.get("/api/settings", requireAuth, async (_req, res) => {
    res.json(await getSettingsRow());
  });

  app.put("/api/settings", requireAuth, async (req, res) => {
    const p = settingsInput.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: p.error.flatten() });
    const current = await getSettingsRow();
    const [row] = await db.update(settings)
      .set({ ownerName: p.data.ownerName ?? null })
      .where(eq(settings.id, current.id)).returning();
    res.json(row);
  });
}
