export function toCents(v: string | number): number {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Math.round(n * 100);
}

export function fromCents(c: number): number {
  return c / 100;
}

export function formatMXN(c: number): string {
  return "$" + (c / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
