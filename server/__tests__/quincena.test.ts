import { describe, it, expect } from "vitest";
import { quincenaHalf, quincenaKey, quincenaRange } from "../lib/quincena";

describe("quincena", () => {
  it("classifies halves", () => {
    expect(quincenaHalf(new Date("2026-07-01"))).toBe(1);
    expect(quincenaHalf(new Date("2026-07-15"))).toBe(1);
    expect(quincenaHalf(new Date("2026-07-16"))).toBe(2);
    expect(quincenaHalf(new Date("2026-07-31"))).toBe(2);
  });
  it("builds key", () => {
    expect(quincenaKey(new Date("2026-07-20"))).toEqual({ year: 2026, month: 7, half: 2 });
  });
  it("computes ranges incl. month end", () => {
    expect(quincenaRange(2026, 7, 1)).toEqual({ start: "2026-07-01", end: "2026-07-15" });
    expect(quincenaRange(2026, 7, 2)).toEqual({ start: "2026-07-16", end: "2026-07-31" });
    expect(quincenaRange(2026, 2, 2)).toEqual({ start: "2026-02-16", end: "2026-02-28" });
  });
});
