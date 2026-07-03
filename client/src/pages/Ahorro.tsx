import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useSavings, useGoal, useGoals, useMutate } from "../hooks";
import { Money } from "../components/Money";

export function Ahorro() {
  const { data: entries = [] } = useSavings();
  const { data: goal } = useGoal();
  const { data: goals = [] } = useGoals();
  const m = useMutate(["savings", "goal"]);
  const mg = useMutate(["goals"]);
  const now = new Date();

  const [amount, setAmount] = useState("");
  const [half, setHalf] = useState(now.getUTCDate() <= 15 ? 1 : 2);

  // new goal form
  const [gName, setGName] = useState("");
  const [gMonthly, setGMonthly] = useState("");
  const [gTarget, setGTarget] = useState("");

  const chart = entries.map((e: any) => ({
    name: `${String(e.month).padStart(2, "0")} Q${e.quincenaHalf}`,
    total: e.total / 100,
  }));
  const total = entries.length ? entries[entries.length - 1].total : 0;

  function saveEntry() {
    if (!amount) return;
    m.mutate({
      path: "/api/savings/entries",
      method: "POST",
      body: { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1, quincenaHalf: half, amountSaved: Number(amount) },
    });
    setAmount("");
  }

  function addGoal() {
    if (!gName || !gMonthly) return;
    mg.mutate({
      path: "/api/goals",
      method: "POST",
      body: { name: gName, monthlyAmount: Number(gMonthly), targetAmount: gTarget ? Number(gTarget) : null },
    });
    setGName(""); setGMonthly(""); setGTarget("");
  }

  function abonar(id: number) {
    const v = window.prompt("¿Cuánto quieres abonar?");
    if (v == null) return;
    const n = Number(v);
    if (!n) return;
    mg.mutate({ path: `/api/goals/${id}/contribute`, method: "POST", body: { amount: n } });
  }

  return (
    <div className="screen">
      <header className="screen-head"><h2>Ahorro</h2></header>

      <div className="hero card">
        <span className="hero-label">Ahorro total</span>
        <div className="hero-value"><Money cents={total} /></div>
        <span className="muted">Meta por quincena <Money cents={goal?.quincenaTarget ?? 0} /></span>
      </div>

      <div className="card">
        <h3>Registrar quincena</h3>
        <div className="row">
          <select value={half} onChange={(e) => setHalf(Number(e.target.value))}>
            <option value={1}>1ª (1–15)</option>
            <option value={2}>2ª (16–fin)</option>
          </select>
          <input type="number" inputMode="numeric" placeholder="Ahorrado" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <button onClick={saveEntry}>Guardar</button>
        </div>
      </div>

      <div className="card">
        <h3>Mis metas</h3>
        {goals.map((g: any) => {
          const pct = g.targetAmount ? Math.min(100, Math.round((g.saved / g.targetAmount) * 100)) : null;
          return (
            <div key={g.id} className="goal">
              <div className="between">
                <strong>{g.name}</strong>
                <span className="muted month-edit">
                  $<input
                    className="inline-num"
                    type="number"
                    inputMode="numeric"
                    defaultValue={g.monthlyAmount / 100}
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (v !== g.monthlyAmount / 100) mg.mutate({ path: `/api/goals/${g.id}`, method: "PATCH", body: { monthlyAmount: v } });
                    }}
                  />/mes
                </span>
              </div>
              <div className="between">
                <span><Money cents={g.saved} />{g.targetAmount ? <> de <Money cents={g.targetAmount} /></> : null}</span>
                {pct != null && <span className="muted">{pct}%</span>}
              </div>
              {pct != null && <div className="bar"><span style={{ width: pct + "%" }} /></div>}
              <div className="row" style={{ marginTop: 8 }}>
                <button onClick={() => abonar(g.id)}>Abonar</button>
                <button className="danger" onClick={() => mg.mutate({ path: `/api/goals/${g.id}`, method: "DELETE" })}>Eliminar</button>
              </div>
            </div>
          );
        })}
        {goals.length === 0 && <p className="muted">Aún no tienes metas. Agrega una abajo.</p>}

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
        <h3>Progreso por quincena</h3>
        {chart.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chart} margin={{ left: -10, right: 8, top: 6 }}>
              <XAxis dataKey="name" fontSize={11} />
              <YAxis fontSize={11} />
              <Tooltip />
              <Line dataKey="total" stroke="#4f46e5" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : <p className="muted">Registra tu primera quincena para ver el progreso.</p>}
        {entries.slice().reverse().map((e: any) => (
          <div key={e.id} className="between goal-row">
            <span>{e.year}-{String(e.month).padStart(2, "0")} Q{e.quincenaHalf}</span>
            <span style={{ color: e.amountSaved >= e.goal ? "var(--good)" : "var(--ink)" }}><Money cents={e.amountSaved} /></span>
          </div>
        ))}
      </div>
    </div>
  );
}
