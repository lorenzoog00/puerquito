export function formatMoney(cents: number): string {
  const n = cents / 100;
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  const whole = Number.isInteger(abs);
  return `${sign}$${abs.toLocaleString("es-MX", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export function Money({ cents }: { cents: number }) {
  return <span className="num">{formatMoney(cents)}</span>;
}
