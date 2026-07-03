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

describe("transactions API", () => {
  it("filters by month and stores cents", async () => {
    const a = request.agent(createApp());
    await a.post("/api/auth/login").send({ email: "me@test.com", password: "secret" });
    const acc = await a.post("/api/accounts").send({ name: "Cash", type: "cash" });
    await a.post("/api/transactions").send({ date: "2026-07-10", amount: 12.5, accountId: acc.body.id, type: "expense" });
    const jul = await a.get("/api/transactions?month=2026-07");
    expect(jul.body).toHaveLength(1);
    expect(jul.body[0].amount).toBe(1250);
    const aug = await a.get("/api/transactions?month=2026-08");
    expect(aug.body).toHaveLength(0);
  });
});
