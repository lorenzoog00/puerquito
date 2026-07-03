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

describe("categories API", () => {
  it("creates with cents budget", async () => {
    const a = request.agent(createApp());
    await a.post("/api/auth/login").send({ email: "me@test.com", password: "secret" });
    await a.post("/api/categories").send({ name: "Food", type: "expense", monthlyBudget: 300 });
    const list = await a.get("/api/categories");
    expect(list.body[0].monthlyBudget).toBe(30000);
  });
});
