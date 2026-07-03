import { useState } from "react";
import { useAccounts, useCategories, useTransactions, useMutate } from "../hooks";
import { Money } from "../components/Money";

function thisMonth() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function Transactions() {
  const [month, setMonth] = useState(thisMonth());
  const { data: txns = [] } = useTransactions(month);
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const m = useMutate(["transactions", "accounts"]);

  const accName = (id: number) => accounts.find((a: any) => a.id === id)?.name ?? "—";
  const catName = (id: number | null) => categories.find((c: any) => c.id === id)?.name ?? "";

  const spent = txns.filter((t: any) => t.type === "expense").reduce((s: number, t: any) => s + t.amount, 0);
  const income = txns.filter((t: any) => t.type === "income").reduce((s: number, t: any) => s + t.amount, 0);

  return (
    <div className="screen">
      <header className="screen-head between" style={{ width: "100%" }}>
        <h2>Historial</h2>
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ maxWidth: 170 }} />
      </header>

      <div className="row" style={{ marginBottom: 14 }}>
        <div className="card" style={{ flex: 1, margin: 0 }}>
          <h3>Gastos</h3><div className="stat" style={{ fontSize: 20, color: "var(--bad)" }}><Money cents={spent} /></div>
        </div>
        <div className="card" style={{ flex: 1, margin: 0 }}>
          <h3>Ingresos</h3><div className="stat" style={{ fontSize: 20, color: "var(--good)" }}><Money cents={income} /></div>
        </div>
      </div>

      <div className="card">
        {txns.map((t: any) => (
          <div key={t.id} className="between goal-row">
            <div>
              <div style={{ fontWeight: 600 }}>{t.note || catName(t.categoryId) || t.type}</div>
              <div className="muted" style={{ fontSize: 13 }}>{t.date.slice(5)} · {accName(t.accountId)}</div>
            </div>
            <div className="row" style={{ flexWrap: "nowrap" }}>
              <span style={{ color: t.type === "income" ? "var(--good)" : "var(--ink)", fontWeight: 600 }}>
                {t.type === "income" ? "+" : "−"}<Money cents={t.amount} />
              </span>
              <button className="danger" onClick={() => m.mutate({ path: `/api/transactions/${t.id}`, method: "DELETE" })}>✕</button>
            </div>
          </div>
        ))}
        {txns.length === 0 && <p className="muted">Sin movimientos este mes.</p>}
      </div>
    </div>
  );
}
