import { describe, it, expect } from "vitest";
import { toCents, fromCents, formatMXN } from "../lib/money";

describe("money", () => {
  it("converts to cents", () => {
    expect(toCents("12.34")).toBe(1234);
    expect(toCents(5)).toBe(500);
    expect(toCents("0.1")).toBe(10);
  });
  it("converts from cents", () => {
    expect(fromCents(1234)).toBe(12.34);
  });
  it("formats MXN", () => {
    expect(formatMXN(123456)).toBe("$1,234.56");
  });
});
