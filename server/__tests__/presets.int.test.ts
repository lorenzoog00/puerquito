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

describe("presets API", () => {
  it("one-tap log creates a transaction from the preset", async () => {
    const a = request.agent(createApp());
    await a.post("/api/auth/login").send({ email: "me@test.com", password: "secret" });
    const acc = await a.post("/api/accounts").send({ name: "Tarjeta", type: "card" });
    const preset = await a.post("/api/presets").send({
      label: "Restaurante", amount: 150, type: "expense", accountId: acc.body.id,
    });
    expect(preset.body.amount).toBe(15000);

    const logged = await a.post(`/api/presets/${preset.body.id}/log`);
    expect(logged.status).toBe(200);
    expect(logged.body.amount).toBe(15000);
    expect(logged.body.note).toBe("Restaurante");

    const txns = await a.get("/api/transactions");
    expect(txns.body).toHaveLength(1);
    expect(txns.body[0].type).toBe("expense");
  });

  it("stores and returns owner name in settings", async () => {
    const a = request.agent(createApp());
    await a.post("/api/auth/login").send({ email: "me@test.com", password: "secret" });
    await a.put("/api/settings").send({ ownerName: "Lorenzo" });
    const s = await a.get("/api/settings");
    expect(s.body.ownerName).toBe("Lorenzo");
  });

  it("log sets transaction name from preset label", async () => {
    const a = request.agent(createApp());
    await a.post("/api/auth/login").send({ email: "me@test.com", password: "secret" });
    const acc = await a.post("/api/accounts").send({ name: "Card", type: "card" });
    const preset = await a.post("/api/presets").send({ label: "Cafecito", amount: 45, type: "expense", accountId: acc.body.id });
    const logged = await a.post(`/api/presets/${preset.body.id}/log`);
    expect(logged.body.name).toBe("Cafecito");
  });
});
