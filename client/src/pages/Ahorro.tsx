import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { useSavings, useGoal, useMutate } from "../hooks";
import { Money } from "../components/Money";

export function Ahorro() {
  const { data: entries = [] } = useSavings();
  const { data: goal } = useGoal();
  const m = useMutate(["savings", "goal"]);
  const now = new Date();

  const [amount, setAmount] = useState("");
  const [half, setHalf] = useState(now.getUTCDate() <= 15 ? 1 : 2);

  const chart = entries.map((e: any) => ({
    name: `${e.year}-${String(e.month).padStart(2, "0")} Q${e.quincenaHalf}`,
    total: e.total / 100,
  }));
  const total = entries.length ? entries[entries.length - 1].total : 0;
  const overall = goal?.overallGoal ?? null;
  const pct = overall ? Math.min(100, Math.round((total / overall) * 100)) : 0;

  function saveGoal(field: "quincenaTarget" | "overallGoal", value: string) {
    m.mutate({
      path: "/api/savings/goal",
      method: "PUT",
      body: {
        quincenaTarget: field === "quincenaTarget" ? Number(value) : (goal ? goal.quincenaTarget / 100 : 0),
        overallGoal: field === "overallGoal" ? (value ? Number(value) : null) : (goal?.overallGoal ? goal.overallGoal / 100 : null),
      },
    });
  }

  function saveEntry() {
    if (!amount) return;
    m.mutate({
      path: "/api/savings/entries",
      method: "POST",
      body: { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1, quincenaHalf: half, amountSaved: Number(amount) },
    });
    setAmount("");
  }

  return (
    <div>
      <div className="page-head"><h2>Ahorro</h2></div>

      <div className="grid">
        <div className="card">
          <h3>Ahorro total</h3>
          <div className="stat"><Money cents={total} /></div>
          {overall != null && (
            <>
              <small>Meta: <Money cents={overall} /> · {pct}%</small>
              <div className="bar"><span style={{ width: pct + "%" }} /></div>
            </>
          )}
        </div>
        <div className="card">
          <h3>Meta por quincena</h3>
          <input
            type="number"
            defaultValue={goal ? goal.quincenaTarget / 100 : 0}
            onBlur={(e) => saveGoal("quincenaTarget", e.target.value)}
          />
          <h3 style={{ marginTop: 14 }}>Meta total (opcional)</h3>
          <input
            type="number"
            defaultValue={goal?.overallGoal ? goal.overallGoal / 100 : ""}
            onBlur={(e) => saveGoal("overallGoal", e.target.value)}
          />
        </div>
      </div>

      <div className="card">
        <h3>Registrar esta quincena</h3>
        <div className="row">
          <select value={half} onChange={(e) => setHalf(Number(e.target.value))}>
            <option value={1}>1ª quincena (1–15)</option>
            <option value={2}>2ª quincena (16–fin)</option>
          </select>
          <input type="number" placeholder="Ahorrado" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <button onClick={saveEntry}>Guardar</button>
        </div>
      </div>

      <div className="card">
        <h3>Progreso</h3>
        {chart.length > 0 && (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chart}>
              <XAxis dataKey="name" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Line dataKey="total" stroke="#4338ca" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
        <table>
          <thead><tr><th>Quincena</th><th>Ahorrado</th><th>Meta</th><th>Acumulado</th><th></th></tr></thead>
          <tbody>
            {entries.map((e: any) => (
              <tr key={e.id}>
                <td>{e.year}-{String(e.month).padStart(2, "0")} Q{e.quincenaHalf}</td>
                <td><Money cents={e.amountSaved} /></td>
                <td style={{ color: e.amountSaved >= e.goal ? "var(--good)" : "var(--muted)" }}><Money cents={e.goal} /></td>
                <td><strong><Money cents={e.total} /></strong></td>
                <td><button className="danger" onClick={() => m.mutate({ path: `/api/savings/entries/${e.id}`, method: "DELETE" })}>✕</button></td>
              </tr>
            ))}
            {entries.length === 0 && <tr><td colSpan={5}><small>Aún no registras ahorro.</small></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
