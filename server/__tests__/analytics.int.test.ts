import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import bcrypt from "bcryptjs";
import request from "supertest";
import { createApp } from "../app";
import { resetDb } from "./helpers/testDb";

beforeAll(() => {
  process.env.SEED_EMAIL = "me@test.com";
  process.env.SEED_PASSWORD_HASH = bcrypt.hashSync("secret", 8);
});
beforeEach(async () => { await resetDb(); });

describe("analytics API", () => {
  it("requires auth", async () => {
    const res = await request(createApp()).get("/api/analytics");
    expect(res.status).toBe(401);
  });

  it("returns aggregated shape with clamped months", async () => {
    const a = request.agent(createApp());
    await a.post("/api/auth/login").send({ email: "me@test.com", password: "secret" });
    const acc = await a.post("/api/accounts").send({ name: "Bank", type: "bank", startingBalance: 1000 });
    const today = new Date().toISOString().slice(0, 10);
    await a.post("/api/transactions").send({ date: today, name: "Tacos", amount: 100, accountId: acc.body.id, type: "expense" });
    const res = await a.get("/api/analytics?months=99"); // invalid → clamp to 6
    expect(res.status).toBe(200);
    expect(res.body.months).toHaveLength(6);
    expect(res.body.disponible).toBe(90000); // 1000.00 - 100.00 pesos, in cents
    const current = res.body.months[res.body.months.length - 1];
    expect(current.expense).toBe(10000);
  });
});
