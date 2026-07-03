import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import bcrypt from "bcryptjs";
import request from "supertest";
import { createApp } from "../app";
import { resetDb } from "./helpers/testDb";

beforeAll(() => {
  process.env.SEED_EMAIL = "me@test.com";
  process.env.SEED_PASSWORD_HASH = bcrypt.hashSync("secret", 8);
});
beforeEach(async () => {
  await resetDb();
});

describe("goals API", () => {
  it("creates a goal and accumulates contributions", async () => {
    const a = request.agent(createApp());
    await a.post("/api/auth/login").send({ email: "me@test.com", password: "secret" });

    const g = await a.post("/api/goals").send({ name: "Viaje", monthlyAmount: 2000, targetAmount: 20000 });
    expect(g.body.monthlyAmount).toBe(200000);
    expect(g.body.targetAmount).toBe(2000000);
    expect(g.body.saved).toBe(0);

    await a.post(`/api/goals/${g.body.id}/contribute`).send({ amount: 2000 });
    const after = await a.post(`/api/goals/${g.body.id}/contribute`).send({ amount: 500 });
    expect(after.body.saved).toBe(250000); // 2000 + 500 -> cents

    const list = await a.get("/api/goals");
    expect(list.body).toHaveLength(1);
    expect(list.body[0].saved).toBe(250000);
  });

  it("does not let saved go below zero on withdraw", async () => {
    const a = request.agent(createApp());
    await a.post("/api/auth/login").send({ email: "me@test.com", password: "secret" });
    const g = await a.post("/api/goals").send({ name: "Laptop", monthlyAmount: 1000 });
    const res = await a.post(`/api/goals/${g.body.id}/contribute`).send({ amount: -500 });
    expect(res.body.saved).toBe(0);
  });

  it("checking a goal moves money out of Débito (reduces balance); uncheck restores it", async () => {
    const a = request.agent(createApp());
    await a.post("/api/auth/login").send({ email: "me@test.com", password: "secret" });
    const acc = await a.post("/api/accounts").send({ name: "Débito", type: "bank", startingBalance: 26000 });
    const g = await a.post("/api/goals").send({ name: "Viaje", monthlyAmount: 2000 });

    await a.post(`/api/goals/${g.body.id}/check`).send({ year: 2026, month: 7 });
    let accounts = await a.get("/api/accounts");
    expect(accounts.body[0].balance).toBe(2400000); // 26000 - 2000 = 24000

    const txns = await a.get("/api/transactions");
    expect(txns.body.some((t: any) => t.type === "transfer" && t.amount === 200000)).toBe(true);

    await a.delete(`/api/goals/${g.body.id}/check?year=2026&month=7`);
    accounts = await a.get("/api/accounts");
    expect(accounts.body[0].balance).toBe(2600000); // restored
    const txns2 = await a.get("/api/transactions");
    expect(txns2.body).toHaveLength(0);
  });

  it("check marks the month done and uncheck removes it", async () => {
    const a = request.agent(createApp());
    await a.post("/api/auth/login").send({ email: "me@test.com", password: "secret" });
    const g = await a.post("/api/goals").send({ name: "Viaje", monthlyAmount: 2000, targetAmount: 20000 });

    const checked = await a.post(`/api/goals/${g.body.id}/check`).send({ year: 2026, month: 7 });
    expect(checked.body.saved).toBe(200000); // monthly $2,000
    expect(checked.body.contributedMonths).toContain("2026-07");

    // idempotent: checking again does not double-count
    const again = await a.post(`/api/goals/${g.body.id}/check`).send({ year: 2026, month: 7 });
    expect(again.body.saved).toBe(200000);

    // a second month adds up
    await a.post(`/api/goals/${g.body.id}/check`).send({ year: 2026, month: 8 });
    const list = await a.get("/api/goals");
    expect(list.body[0].saved).toBe(400000);
    expect(list.body[0].contributedMonths).toEqual(["2026-07", "2026-08"]);

    const unchecked = await a.delete(`/api/goals/${g.body.id}/check?year=2026&month=8`);
    expect(unchecked.body.saved).toBe(200000);
    expect(unchecked.body.contributedMonths).toEqual(["2026-07"]);
  });
});
