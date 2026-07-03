import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import bcrypt from "bcryptjs";
import request from "supertest";
import { createApp } from "../app";
import { resetDb } from "./helpers/testDb";

const agent = () => request.agent(createApp());
async function login(a: ReturnType<typeof agent>) {
  await a.post("/api/auth/login").send({ email: "me@test.com", password: "secret" });
}

beforeAll(() => {
  process.env.SEED_EMAIL = "me@test.com";
  process.env.SEED_PASSWORD_HASH = bcrypt.hashSync("secret", 8);
});
beforeEach(async () => {
  await resetDb();
});

describe("accounts API", () => {
  it("requires auth", async () => {
    const res = await request(createApp()).get("/api/accounts");
    expect(res.status).toBe(401);
  });
  it("creates and lists with balance", async () => {
    const a = agent();
    await login(a);
    const created = await a.post("/api/accounts").send({ name: "Cash", type: "cash", startingBalance: 100 });
    expect(created.status).toBe(200);
    const list = await a.get("/api/accounts");
    expect(list.body[0].name).toBe("Cash");
    expect(list.body[0].balance).toBe(10000);
  });
});
