import { useState } from "react";
import { useCategories, useTransactions, useMutate } from "../hooks";
import { Money } from "../components/Money";

function thisMonth() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function Budgets() {
  const month = thisMonth();
  const { data: categories = [] } = useCategories();
  const { data: txns = [] } = useTransactions(month);
  const m = useMutate(["categories"]);

  const [name, setName] = useState("");
  const [type, setType] = useState("expense");
  const [budget, setBudget] = useState("");

  function add() {
    if (!name) return;
    m.mutate({
      path: "/api/categories",
      method: "POST",
      body: { name, type, monthlyBudget: budget ? Number(budget) : null },
    });
    setName("");
    setBudget("");
  }

  const spentFor = (catId: number) =>
    txns.filter((t: any) => t.categoryId === catId && t.type === "expense")
      .reduce((s: number, t: any) => s + t.amount, 0);

  const budgeted = categories.filter((c: any) => c.type === "expense" && c.monthlyBudget != null);

  return (
    <div>
      <h2>Presupuestos <small>({month})</small></h2>

      <div className="card">
        {budgeted.length === 0 && <small>Define un presupuesto mensual en una categoría de gasto.</small>}
        {budgeted.map((c: any) => {
          const spent = spentFor(c.id);
          const pct = Math.min(100, Math.round((spent / c.monthlyBudget) * 100));
          const over = spent > c.monthlyBudget;
          return (
            <div key={c.id} style={{ marginBottom: 16 }}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <strong>{c.name}</strong>
                <span style={{ color: over ? "var(--bad)" : "var(--muted)" }}>
                  <Money cents={spent} /> / <Money cents={c.monthlyBudget} />
                </span>
              </div>
              <div className={"bar" + (over ? " over" : "")}><span style={{ width: pct + "%" }} /></div>
            </div>
          );
        })}
      </div>

      <div className="card">
        <h3>Nueva categoría</h3>
        <div className="row">
          <input placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="expense">Gasto</option>
            <option value="income">Ingreso</option>
          </select>
          <input type="number" placeholder="Presupuesto mensual" value={budget} onChange={(e) => setBudget(e.target.value)} />
          <button onClick={add}>Agregar</button>
        </div>
      </div>
    </div>
  );
}
