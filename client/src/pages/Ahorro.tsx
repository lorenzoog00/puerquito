import { useState } from "react";
import { useSavings, useGoal, useGoals, useMutate } from "../hooks";
import { Money } from "../components/Money";

function mk(y: number, m: number) {
  return `${y}-${String(m).padStart(2, "0")}`;
}

// Consecutive months contributed, ending at the current month.
function streakOf(months: string[]) {
  const set = new Set(months);
  const d = new Date();
  let y = d.getUTCFullYear(), m = d.getUTCMonth() + 1, n = 0;
  while (set.has(mk(y, m))) { n++; m--; if (m === 0) { m = 12; y--; } }
  return n;
}

// Last `count` months (oldest -> newest) with done flag.
function lastMonths(months: string[], count = 6) {
  const set = new Set(months);
  const d = new Date();
  let y = d.getUTCFullYear(), m = d.getUTCMonth() + 1;
  const out: { key: string; label: string; done: boolean }[] = [];
  for (let i = 0; i < count; i++) {
    out.unshift({ key: mk(y, m), label: String(m).padStart(2, "0"), done: set.has(mk(y, m)) });
    m--; if (m === 0) { m = 12; y--; }
  }
  return out;
}

export function Ahorro() {
  const { data: entries = [] } = useSavings();
  const { data: goal } = useGoal();
  const { data: goals = [] } = useGoals();
  const mSav = useMutate(["savings", "goal", "accounts", "transactions"]);
  const mg = useMutate(["goals", "accounts", "transactions"]);
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const ymKey = mk(year, month);

  const [amount, setAmount] = useState("");
  const [half, setHalf] = useState(now.getUTCDate() <= 15 ? 1 : 2);
  const [gName, setGName] = useState("");
  const [gMonthly, setGMonthly] = useState("");
  const [gTarget, setGTarget] = useState("");

  const total = entries.length ? entries[entries.length - 1].total : 0;

  function saveEntry() {
    if (!amount) return;
    mSav.mutate({ path: "/api/savings/entries", method: "POST", body: { year, month, quincenaHalf: half, amountSaved: Number(amount) } });
    setAmount("");
  }
  function addGoal() {
    if (!gName || !gMonthly) return;
    mg.mutate({ path: "/api/goals", method: "POST", body: { name: gName, monthlyAmount: Number(gMonthly), targetAmount: gTarget ? Number(gTarget) : null } });
    setGName(""); setGMonthly(""); setGTarget("");
  }
  function toggle(g: any, done: boolean) {
    if (done) mg.mutate({ path: `/api/goals/${g.id}/check?year=${year}&month=${month}`, method: "DELETE" });
    else mg.mutate({ path: `/api/goals/${g.id}/check`, method: "POST", body: { year, month } });
  }
  function abonar(id: number) {
    const v = window.prompt("¿Cuánto quieres abonar este mes?");
    if (v == null) return;
    const n = Number(v);
    if (!n) return;
    mg.mutate({ path: `/api/goals/${id}/contribute`, method: "POST", body: { amount: n, year, month } });
  }

  return (
    <div className="screen">
      <header className="screen-head"><h2>Metas</h2></header>

      <div className="hero card">
        <span className="hero-label">Ahorro total</span>
        <div className="hero-value"><Money cents={total} /></div>
        <span className="muted">Meta por quincena <Money cents={goal?.quincenaTarget ?? 0} /></span>
      </div>

      {goals.map((g: any) => {
        const done = (g.contributedMonths || []).includes(ymKey);
        const pct = g.targetAmount ? Math.min(100, Math.round((g.saved / g.targetAmount) * 100)) : null;
        const streak = streakOf(g.contributedMonths || []);
        return (
          <div key={g.id} className="card">
            <div className="between">
              <strong style={{ fontSize: 17 }}>{g.name}</strong>
              <span className="muted month-edit">$<input className="inline-num" type="number" inputMode="numeric"
                defaultValue={g.monthlyAmount / 100}
                onBlur={(e) => { const v = Number(e.target.value); if (v !== g.monthlyAmount / 100) mg.mutate({ path: `/api/goals/${g.id}`, method: "PATCH", body: { monthlyAmount: v } }); }} />/mes</span>
            </div>

            <div className="between" style={{ marginTop: 6 }}>
              <span><Money cents={g.saved} />{g.targetAmount ? <span className="muted"> de <Money cents={g.targetAmount} /></span> : null}</span>
              {pct != null && <span className="muted">{pct}%</span>}
            </div>
            {pct != null && <div className="bar"><span style={{ width: pct + "%" }} /></div>}

            <div className="dots">
              {lastMonths(g.contributedMonths || []).map((d) => (
                <span key={d.key} className={"dot " + (d.done ? "on" : "")}>{d.label}</span>
              ))}
              {streak > 0 && <span className="streak">Racha {streak}</span>}
            </div>

            <button className={"check-item " + (done ? "done" : "")} onClick={() => toggle(g, done)} style={{ marginTop: 10 }}>
              <span className="check-circle">{done ? "✓" : ""}</span>
              <span className="check-label">{done ? "Hecho este mes" : "Marcar este mes"}</span>
              <span className="check-amount"><Money cents={g.monthlyAmount} /></span>
            </button>

            <div className="row" style={{ marginTop: 10 }}>
              <button onClick={() => abonar(g.id)}>Abonar otro monto</button>
              <button className="danger" onClick={() => mg.mutate({ path: `/api/goals/${g.id}`, method: "DELETE" })}>Eliminar</button>
            </div>
          </div>
        );
      })}

      <div className="card">
        <h3>Nueva meta</h3>
        <div className="goal-form">
          <input placeholder="Nombre (ej. Viaje)" value={gName} onChange={(e) => setGName(e.target.value)} />
          <div className="row">
            <input type="number" inputMode="numeric" placeholder="$ al mes" value={gMonthly} onChange={(e) => setGMonthly(e.target.value)} />
            <input type="number" inputMode="numeric" placeholder="Meta total (opcional)" value={gTarget} onChange={(e) => setGTarget(e.target.value)} />
          </div>
          <button onClick={addGoal}>Agregar meta</button>
        </div>
      </div>

      <div className="card">
        <h3>Registrar ahorro de quincena</h3>
        <div className="row">
          <select value={half} onChange={(e) => setHalf(Number(e.target.value))}>
            <option value={1}>1ª (1–15)</option>
            <option value={2}>2ª (16–fin)</option>
          </select>
          <input type="number" inputMode="numeric" placeholder="Ahorrado" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <button onClick={saveEntry}>Guardar</button>
        </div>
      </div>
    </div>
  );
}
