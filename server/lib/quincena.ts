export function quincenaHalf(d: Date): 1 | 2 {
  return d.getUTCDate() <= 15 ? 1 : 2;
}

export function quincenaKey(d: Date) {
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, half: quincenaHalf(d) };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function quincenaRange(year: number, month: number, half: 1 | 2) {
  if (half === 1) {
    return { start: `${year}-${pad(month)}-01`, end: `${year}-${pad(month)}-15` };
  }
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { start: `${year}-${pad(month)}-16`, end: `${year}-${pad(month)}-${pad(lastDay)}` };
}

export function quincenaLabel(year: number, month: number, half: 1 | 2): string {
  return `${year}-${pad(month)} Q${half}`;
}
