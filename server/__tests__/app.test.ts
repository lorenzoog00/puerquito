import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../app";

describe("app", () => {
  it("health check works", async () => {
    const res = await request(createApp()).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
  it("protected route without session 401s", async () => {
    const res = await request(createApp()).get("/api/auth/me");
    expect(res.status).toBe(401);
  });
});
