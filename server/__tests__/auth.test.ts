import { describe, it, expect, beforeAll } from "vitest";
import bcrypt from "bcryptjs";

describe("verifyCredentials", () => {
  beforeAll(() => {
    process.env.SEED_EMAIL = "me@test.com";
    process.env.SEED_PASSWORD_HASH = bcrypt.hashSync("secret", 8);
  });
  it("accepts correct creds", async () => {
    const { verifyCredentials } = await import("../user");
    expect(await verifyCredentials("me@test.com", "secret")).toBe(true);
  });
  it("rejects wrong password", async () => {
    const { verifyCredentials } = await import("../user");
    expect(await verifyCredentials("me@test.com", "nope")).toBe(false);
  });
});
