import { describe, it, expect } from "vitest";
import { ymList, buildAnalytics } from "../lib/analytics";

const now = new Date("2026-07-15T12:00:00Z");

describe("ymList", () => {
  it("returns `months` ascending keys ending in the current month", () => {
    expect(ymList(now, 3)).toEqual(["2026-05", "2026-06", "2026-07"]);
  });
});

describe("buildAnalytics", () => {
  const base = {
    now, months: 3,
    accounts: [
      { id: 1, type: "bank", startingBalance: 100000 },
      { id: 2, type: "savings", startingBalance: 500000 },
    ],
    categories: [
      { id: 10, name: "Comida", monthlyBudget: 60000 },
      { id: 11, name: "Transporte", monthlyBudget: null },
    ],
    savingsEntries: [{ year: 2026, month: 7, amountSaved: 20000 }],
    goalContribs: [{ year: 2026, month: 6, amount: 5000 }],
  };

  it("buckets expense/income by month and excludes transfers", () => {
    const r = buildAnalytics({ ...base, txns: [
      { date: "2026-07-02", amount: 30000, type: "expense", categoryId: 10, accountId: 1 },
      { date: "2026-07-03", amount: 80000, type: "income",  categoryId: null, accountId: 1 },
      { date: "2026-07-04", amount: 10000, type: "transfer", categoryId: null, accountId: 1 },
      { date: "2026-06-10", amount: 15000, type: "expense", categoryId: 11, accountId: 1 },
    ]});
    expect(r.months).toEqual([
      { ym: "2026-05", expense: 0, income: 0 },
      { ym: "2026-06", expense: 15000, income: 0 },
      { ym: "2026-07", expense: 30000, income: 80000 },
    ]);
  });

  it("sums current-month expenses per category and keeps budgeted categories", () => {
    const r = buildAnalytics({ ...base, txns: [
      { date: "2026-07-02", amount: 30000, type: "expense", categoryId: 10, accountId: 1 },
    ]});
    expect(r.categories).toEqual([{ id: 10, name: "Comida", spent: 30000, budget: 60000 }]);
  });

  it("keeps a budgeted category even with zero spend", () => {
    const r = buildAnalytics({ ...base, txns: [] });
    expect(r.categories).toEqual([{ id: 10, name: "Comida", spent: 0, budget: 60000 }]);
  });

  it("buckets uncategorized expenses as 'Sin categoría'", () => {
    const r = buildAnalytics({ ...base, txns: [
      { date: "2026-07-05", amount: 12000, type: "expense", categoryId: null, accountId: 1 },
      { date: "2026-07-06", amount: 30000, type: "expense", categoryId: 10, accountId: 1 },
    ]});
    expect(r.categories).toContainEqual({ id: null, name: "Sin categoría", spent: 12000, budget: null });
  });

  it("computes savings cumulative and savings rate for the current month", () => {
    const r = buildAnalytics({ ...base, txns: [
      { date: "2026-07-03", amount: 80000, type: "income", categoryId: null, accountId: 1 },
    ]});
    expect(r.savings).toEqual([
      { ym: "2026-05", saved: 0, cumulative: 0 },
      { ym: "2026-06", saved: 5000, cumulative: 5000 },
      { ym: "2026-07", saved: 20000, cumulative: 25000 },
    ]);
    expect(r.savingsRate).toBeCloseTo(20000 / 80000);
  });

  it("returns savingsRate 0 when income is 0", () => {
    const r = buildAnalytics({ ...base, txns: [] });
    expect(r.savingsRate).toBe(0);
  });

  it("disponible sums non-savings account balances over ALL txns", () => {
    const r = buildAnalytics({ ...base, txns: [
      { date: "2026-01-01", amount: 40000, type: "expense", categoryId: 10, accountId: 1 },
    ]});
    expect(r.disponible).toBe(60000); // 100000 starting - 40000 expense; savings acct excluded
  });
});
