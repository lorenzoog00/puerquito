import { describe, it, expect } from "vitest";
import { applyTxn } from "../lib/balance";

describe("balance", () => {
  it("adds income, subtracts expense/transfer", () => {
    const bal = applyTxn(10000, [
      { amount: 5000, type: "income" },
      { amount: 2000, type: "expense" },
      { amount: 1000, type: "transfer" },
    ]);
    expect(bal).toBe(12000);
  });
});
