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

describe("savings API", () => {
  it("upserts entry and computes goal + running total", async () => {
    const a = request.agent(createApp());
    await a.post("/api/auth/login").send({ email: "me@test.com", password: "secret" });
    await a.put("/api/savings/goal").send({ quincenaTarget: 2000 });
    await a.post("/api/savings/entries").send({ year: 2026, month: 7, quincenaHalf: 1, amountSaved: 1800 });
    let list = await a.get("/api/savings/entries");
    expect(list.body).toHaveLength(1);
    expect(list.body[0].goal).toBe(200000);
    expect(list.body[0].total).toBe(180000);
    await a.post("/api/savings/entries").send({ year: 2026, month: 7, quincenaHalf: 1, amountSaved: 2500 });
    list = await a.get("/api/savings/entries");
    expect(list.body).toHaveLength(1);
    expect(list.body[0].amountSaved).toBe(250000);
  });
});
