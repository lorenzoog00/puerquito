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

describe("recurring pay", () => {
  it("creates a transaction and advances due date", async () => {
    const a = request.agent(createApp());
    await a.post("/api/auth/login").send({ email: "me@test.com", password: "secret" });
    const acc = await a.post("/api/accounts").send({ name: "Bank", type: "bank" });
    const rec = await a.post("/api/recurring").send({
      name: "Rent", amount: 500, accountId: acc.body.id,
      frequency: "monthly", nextDueDate: "2026-07-01",
    });
    const paid = await a.post(`/api/recurring/${rec.body.id}/pay`);
    expect(paid.body.nextDueDate).toBe("2026-08-01");
    const txns = await a.get("/api/transactions");
    expect(txns.body).toHaveLength(1);
    expect(txns.body[0].amount).toBe(50000);
  });
});
