import { describe, it, expect } from "vitest";
import { accountInput, transactionInput } from "@shared/validators";

describe("validators", () => {
  it("accepts a valid account", () => {
    const r = accountInput.safeParse({ name: "Cash", type: "cash", startingBalance: 100 });
    expect(r.success).toBe(true);
  });
  it("rejects bad account type", () => {
    const r = accountInput.safeParse({ name: "X", type: "crypto" });
    expect(r.success).toBe(false);
  });
  it("rejects transaction with negative amount", () => {
    const r = transactionInput.safeParse({ date: "2026-07-01", amount: -5, accountId: 1, type: "expense" });
    expect(r.success).toBe(false);
  });
});
