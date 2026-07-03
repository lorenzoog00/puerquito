import { useAccounts, useTransactions, useRecurring, useSavings, useGoal } from "../hooks";
import { Money } from "../components/Money";

function thisMonth() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function Dashboard() {
  const month = thisMonth();
  const { data: accounts = [] } = useAccounts();
  const { data: txns = [] } = useTransactions(month);
  const { data: recs = [] } = useRecurring();
  const { data: savings = [] } = useSavings();
  const { data: goal } = useGoal();

  const now = new Date();
  const half = now.getUTCDate() <= 15 ? 1 : 2;

  const netWorth = accounts.reduce((s: number, a: any) => s + a.balance, 0);
  const spent = txns.filter((t: any) => t.type === "expense").reduce((s: number, t: any) => s + t.amount, 0);
  const income = txns.filter((t: any) => t.type === "income").reduce((s: number, t: any) => s + t.amount, 0);

  const thisQ = savings.find(
    (e: any) => e.year === now.getUTCFullYear() && e.month === now.getUTCMonth() + 1 && e.quincenaHalf === half
  );
  const savedQ = thisQ?.amountSaved ?? 0;
  const goalQ = thisQ?.goal ?? goal?.quincenaTarget ?? 0;

  const upcoming = [...recs].sort((a: any, b: any) => a.nextDueDate.localeCompare(b.nextDueDate)).slice(0, 3);
  const recent = [...txns].slice(0, 5);

  return (
    <div>
      <h2>Dashboard</h2>

      <div className="grid">
        <div className="card"><h3>Patrimonio neto</h3><div className="stat"><Money cents={netWorth} /></div></div>
        <div className="card"><h3>Gastos del mes</h3><div className="stat" style={{ color: "var(--bad)" }}><Money cents={spent} /></div></div>
        <div className="card"><h3>Ingresos del mes</h3><div className="stat" style={{ color: "var(--good)" }}><Money cents={income} /></div></div>
        <div className="card">
          <h3>Ahorro esta quincena</h3>
          <div className="stat"><Money cents={savedQ} /></div>
          <small>Meta: <Money cents={goalQ} /></small>
        </div>
      </div>

      <div className="grid">
        <div className="card">
          <h3>Próximos recurrentes</h3>
          <table>
            <tbody>
              {upcoming.map((r: any) => (
                <tr key={r.id}><td>{r.name}</td><td>{r.nextDueDate}</td><td><Money cents={r.amount} /></td></tr>
              ))}
              {upcoming.length === 0 && <tr><td><small>Ninguno.</small></td></tr>}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h3>Movimientos recientes</h3>
          <table>
            <tbody>
              {recent.map((t: any) => (
                <tr key={t.id}>
                  <td>{t.date}</td>
                  <td>{t.note || t.type}</td>
                  <td style={{ color: t.type === "income" ? "var(--good)" : "var(--ink)" }}>
                    {t.type === "income" ? "+" : "−"}<Money cents={t.amount} />
                  </td>
                </tr>
              ))}
              {recent.length === 0 && <tr><td><small>Sin movimientos.</small></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
