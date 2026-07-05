import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, AreaChart, Area, ResponsiveContainer, Tooltip } from "recharts";
import { useAnalytics } from "../hooks";
import { Money } from "../components/Money";

const RANGES = [3, 6, 12];
const COLORS = ["#e5679a", "#f4a259", "#5b8e7d", "#6a8eae", "#bc6c25", "#8367c7", "#43aa8b"];

export function Analisis() {
  const nav = useNavigate();
  const [months, setMonths] = useState(6);
  const { data, isLoading } = useAnalytics(months);

  if (isLoading || !data) return <div className="card"><p className="muted">Cargando análisis…</p></div>;

  const expenseCats = data.categories.filter((c: any) => c.spent > 0);
  const totalSpent = expenseCats.reduce((s: number, c: any) => s + c.spent, 0);
  const monthsData = data.months.map((m: any) => ({ ...m, label: m.ym.slice(5) }));
  const withData = data.months.filter((m: any) => m.expense > 0 || m.income > 0).length;
  const withSavingsData = data.savings.filter((s: any) => s.saved !== 0).length;
  const thisMonth = data.months[data.months.length - 1];
  const prevMonth = data.months[data.months.length - 2];
  const delta = prevMonth ? thisMonth.expense - prevMonth.expense : 0;
  const budgeted = data.categories.filter((c: any) => c.budget > 0);
  const savingsData = data.savings.map((s: any) => ({ ...s, label: s.ym.slice(5) }));

  return (
    <div className="col" style={{ gap: 14 }}>
      <div className="between">
        <h3 style={{ margin: 0 }}>Tu dinero</h3>
        <div className="seg" style={{ width: "auto" }}>
          {RANGES.map((r) => (
            <button key={r} className={months === r ? "on" : ""} onClick={() => setMonths(r)}>{r}m</button>
          ))}
        </div>
      </div>

      {/* Block 1 — where money goes */}
      <div className="card">
        <h4 style={{ margin: "0 0 8px" }}>¿A dónde se va?</h4>
        {totalSpent === 0 ? (
          <p className="muted">Aún no hay gastos este mes.</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={expenseCats} dataKey="spent" nameKey="name" innerRadius={50} outerRadius={80}>
                  {expenseCats.map((c: any, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]}
                      onClick={() => c.id != null && nav(`/historial?categoryId=${c.id}`)} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => "$" + (v / 100).toFixed(2)} />
              </PieChart>
            </ResponsiveContainer>
            {expenseCats.map((c: any, i: number) => (
              <div key={c.id ?? "none"} className="between goal-row"
                onClick={() => c.id != null && nav(`/historial?categoryId=${c.id}`)}>
                <span><span style={{ color: COLORS[i % COLORS.length] }}>●</span> {c.name}</span>
                <span><Money cents={c.spent} /> <span className="muted" style={{ fontSize: 13 }}>{Math.round((c.spent / totalSpent) * 100)}%</span></span>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Block 2 — trend */}
      <div className="card">
        <h4 style={{ margin: "0 0 8px" }}>Tendencia</h4>
        {withData < 2 ? (
          <p className="muted">Aún no hay suficientes datos.</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={monthsData}>
                <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v: any) => "$" + (v / 100).toFixed(2)} />
                <Bar dataKey="income" fill="#5b8e7d" radius={[3, 3, 0, 0]} />
                <Bar dataKey="expense" fill="#e5679a" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <p className="muted" style={{ margin: "6px 0 0" }}>
              {delta === 0 ? "Igual que el mes pasado" :
                delta > 0 ? <>Gastas <Money cents={delta} /> más que el mes pasado</> :
                <>Gastas <Money cents={-delta} /> menos que el mes pasado</>}
            </p>
          </>
        )}
      </div>

      {/* Block 3 — on track */}
      <div className="card">
        <h4 style={{ margin: "0 0 8px" }}>¿Vas bien?</h4>
        {budgeted.length === 0 ? (
          <p className="muted">Agrega presupuestos por categoría para ver tu avance.</p>
        ) : budgeted.map((c: any) => {
          const pct = Math.min(100, Math.round((c.spent / c.budget) * 100));
          const color = pct < 75 ? "#5b8e7d" : pct < 100 ? "#f4a259" : "#e5679a";
          return (
            <div key={c.id} style={{ margin: "8px 0" }}>
              <div className="between" style={{ fontSize: 14 }}>
                <span>{c.name}</span>
                <span><Money cents={c.spent} /> / <Money cents={c.budget} /></span>
              </div>
              <div style={{ height: 8, background: "#eee", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: pct + "%", height: "100%", background: color }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Block 4 — savings */}
      <div className="card">
        <h4 style={{ margin: "0 0 8px" }}>Ahorro</h4>
        {withSavingsData < 1 ? (
          <p className="muted">Aún no hay suficientes datos.</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={savingsData}>
                <XAxis dataKey="label" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v: any) => "$" + (v / 100).toFixed(2)} />
                <Area dataKey="cumulative" stroke="#5b8e7d" fill="#c9e4d8" />
              </AreaChart>
            </ResponsiveContainer>
            <p className="muted" style={{ margin: "6px 0 0" }}>
              Este mes ahorraste el {Math.round(data.savingsRate * 100)}% de tus ingresos
            </p>
          </>
        )}
      </div>
    </div>
  );
}
