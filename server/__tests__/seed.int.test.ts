import { describe, it, expect, beforeEach } from "vitest";
import { seedPersonalData } from "../seedData";
import { resetDb, db } from "./helpers/testDb";
import { accounts, categories, presets, settings, savingsGoal } from "@shared/schema";

beforeEach(async () => {
  await resetDb();
});

describe("personalized seed", () => {
  it("seeds Lorenzo's accounts, categories, presets, name and goal", async () => {
    await seedPersonalData();

    const accs = await db.select().from(accounts);
    expect(accs.map((a: any) => a.name).sort()).toEqual(
      ["Ahorro (inversión)", "Débito", "Tarjeta de crédito"]
    );
    expect(accs.find((a: any) => a.type === "savings")).toBeTruthy();

    const cats = await db.select().from(categories);
    expect(cats).toHaveLength(7);

    const ps = await db.select().from(presets);
    const quincena = ps.find((p: any) => p.label === "Quincena");
    expect(quincena?.type).toBe("income");
    expect(quincena?.amount).toBe(2600000); // $26,000
    expect(ps.find((p: any) => p.label === "Restaurante")?.amount).toBe(15000);

    const s = await db.select().from(settings);
    expect(s[0].ownerName).toBe("Lorenzo");

    const g = await db.select().from(savingsGoal);
    expect(g[0].quincenaTarget).toBe(1450000); // $14,500
  });

  it("is idempotent (no duplicates on second run)", async () => {
    await seedPersonalData();
    await seedPersonalData();
    const accs = await db.select().from(accounts);
    expect(accs).toHaveLength(3);
  });
});
