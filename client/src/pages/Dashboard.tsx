import { useAccounts, useTransactions, useRecurring, useSavings, useGoal, usePresets, useSettings, useMutate } from "../hooks";
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
  const { data: presets = [] } = usePresets();
  const { data: settings } = useSettings();
  const logPreset = useMutate(["transactions", "accounts"]);

  const now = new Date();
  const half = now.getUTCDate() <= 15 ? 1 : 2;

  const total = savings.length ? savings[savings.length - 1].total : 0;
  const overall = goal?.overallGoal ?? null;
  const pct = overall ? Math.min(100, Math.round((total / overall) * 100)) : 0;

  const thisQ = savings.find(
    (e: any) => e.year === now.getUTCFullYear() && e.month === now.getUTCMonth() + 1 && e.quincenaHalf === half
  );
  const savedQ = thisQ?.amountSaved ?? 0;
  const goalQ = thisQ?.goal ?? goal?.quincenaTarget ?? 0;
  const qpct = goalQ ? Math.min(100, Math.round((savedQ / goalQ) * 100)) : 0;

  const upcoming = [...recs].sort((a: any, b: any) => a.nextDueDate.localeCompare(b.nextDueDate)).slice(0, 3);
  const recent = [...txns].slice(0, 5);
  const name = settings?.ownerName;

  return (
    <div>
      <div className="page-head">
        <h2>{name ? `Hola, ${name}` : "Resumen"}</h2>
        <span className="muted">{now.toLocaleDateString("es-MX", { day: "numeric", month: "long" })}</span>
      </div>

      <div className="hero card">
        <span className="hero-label">Ahorro total</span>
        <div className="hero-value"><Money cents={total} /></div>
        {overall != null ? (
          <>
            <div className="bar"><span style={{ width: pct + "%" }} /></div>
            <span className="muted">Meta <Money cents={overall} /> · {pct}%</span>
          </>
        ) : (
          <span className="muted">Define tu meta total en Ajustes</span>
        )}
      </div>

      {presets.length > 0 && (
        <div className="card">
          <h3>Registrar rápido</h3>
          <div className="preset-row">
            {presets.map((p: any) => (
              <button
                key={p.id}
                className={"preset " + (p.type === "income" ? "preset-in" : "")}
                disabled={logPreset.isPending}
                onClick={() => logPreset.mutate({ path: `/api/presets/${p.id}/log`, method: "POST" })}
              >
                <span className="preset-label">{p.label}</span>
                <span className="preset-amount">{p.type === "income" ? "+" : ""}<Money cents={p.amount} /></span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid">
        <div className="card">
          <h3>Ahorro esta quincena</h3>
          <div className="stat"><Money cents={savedQ} /></div>
          <div className="bar"><span style={{ width: qpct + "%" }} /></div>
          <span className="muted">Meta <Money cents={goalQ} /></span>
        </div>
        <div className="card">
          <h3>Gastos del mes</h3>
          <div className="stat"><Money cents={txns.filter((t: any) => t.type === "expense").reduce((s: number, t: any) => s + t.amount, 0)} /></div>
        </div>
        <div className="card">
          <h3>Patrimonio neto</h3>
          <div className="stat"><Money cents={accounts.reduce((s: number, a: any) => s + a.balance, 0)} /></div>
        </div>
      </div>

      <div className="grid">
        <div className="card">
          <h3>Próximos recurrentes</h3>
          <table>
            <tbody>
              {upcoming.map((r: any) => (
                <tr key={r.id}><td>{r.name}</td><td className="muted">{r.nextDueDate}</td><td className="right"><Money cents={r.amount} /></td></tr>
              ))}
              {upcoming.length === 0 && <tr><td className="muted">Ninguno.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h3>Movimientos recientes</h3>
          <table>
            <tbody>
              {recent.map((t: any) => (
                <tr key={t.id}>
                  <td className="muted">{t.date}</td>
                  <td>{t.note || t.type}</td>
                  <td className="right" style={{ color: t.type === "income" ? "var(--good)" : "var(--ink)" }}>
                    {t.type === "income" ? "+" : "−"}<Money cents={t.amount} />
                  </td>
                </tr>
              ))}
              {recent.length === 0 && <tr><td className="muted">Sin movimientos.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
