import { applyTxn } from "./balance";

export interface AnalyticsInput {
  now: Date;
  months: number;
  accounts: { id: number; type: string; startingBalance: number }[];
  txns: { date: string; amount: number; type: string; categoryId: number | null; accountId: number }[];
  categories: { id: number; name: string; monthlyBudget: number | null }[];
  savingsEntries: { year: number; month: number; amountSaved: number }[];
  goalContribs: { year: number; month: number; amount: number }[];
}

export interface AnalyticsResult {
  months: { ym: string; expense: number; income: number }[];
  categories: { id: number | null; name: string; spent: number; budget: number | null }[];
  savings: { ym: string; saved: number; cumulative: number }[];
  savingsRate: number;
  disponible: number;
}

export function ymList(now: Date, months: number): string[] {
  const out: string[] = [];
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth(); // 0-based
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - i, 1));
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

export function buildAnalytics(input: AnalyticsInput): AnalyticsResult {
  const { now, months, accounts, txns, categories, savingsEntries, goalContribs } = input;
  const keys = ymList(now, months);
  const currentYm = keys[keys.length - 1];
  const ymOf = (isoDate: string) => isoDate.slice(0, 7);
  const ymKey = (year: number, month: number) => `${year}-${String(month).padStart(2, "0")}`;

  // months[] — expense/income per month, transfers excluded
  const monthsOut = keys.map((ym) => {
    let expense = 0, income = 0;
    for (const t of txns) {
      if (ymOf(t.date) !== ym) continue;
      if (t.type === "expense") expense += t.amount;
      else if (t.type === "income") income += t.amount;
    }
    return { ym, expense, income };
  });

  // categories[] — current-month expense per category; keep budgeted categories even at 0
  const spentByCat = new Map<number | null, number>();
  for (const t of txns) {
    if (t.type !== "expense" || ymOf(t.date) !== currentYm) continue;
    spentByCat.set(t.categoryId, (spentByCat.get(t.categoryId) ?? 0) + t.amount);
  }
  const categoriesOut: AnalyticsResult["categories"] = [];
  for (const c of categories) {
    const spent = spentByCat.get(c.id) ?? 0;
    if (spent === 0 && c.monthlyBudget == null) continue; // drop empty, unbudgeted
    categoriesOut.push({ id: c.id, name: c.name, spent, budget: c.monthlyBudget });
  }
  const uncategorized = spentByCat.get(null) ?? 0;
  if (uncategorized > 0) categoriesOut.push({ id: null, name: "Sin categoría", spent: uncategorized, budget: null });
  categoriesOut.sort((a, b) => b.spent - a.spent);

  // savings[] — savingsEntries + goalContributions per month, running cumulative over the range
  let cumulative = 0;
  const savingsOut = keys.map((ym) => {
    let saved = 0;
    for (const e of savingsEntries) if (ymKey(e.year, e.month) === ym) saved += e.amountSaved;
    for (const g of goalContribs) if (ymKey(g.year, g.month) === ym) saved += g.amount;
    cumulative += saved;
    return { ym, saved, cumulative };
  });

  const currentIncome = monthsOut[monthsOut.length - 1].income;
  const currentSaved = savingsOut[savingsOut.length - 1].saved;
  const savingsRate = currentIncome > 0 ? currentSaved / currentIncome : 0;

  const disponible = accounts
    .filter((a) => a.type !== "savings")
    .reduce((sum, a) => sum + applyTxn(a.startingBalance, txns.filter((t) => t.accountId === a.id)), 0);

  return { months: monthsOut, categories: categoriesOut, savings: savingsOut, savingsRate, disponible };
}
