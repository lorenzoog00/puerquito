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

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [type, setType] = useState("expense");
  const [note, setNote] = useState("");

  function add() {
    if (!amount || !accountId) return;
    m.mutate({
      path: "/api/transactions",
      method: "POST",
      body: {
        date,
        amount: Number(amount),
        accountId: Number(accountId),
        categoryId: categoryId ? Number(categoryId) : null,
        type,
        note: note || null,
      },
    });
    setAmount("");
    setNote("");
  }

  const accName = (id: number) => accounts.find((a: any) => a.id === id)?.name ?? "—";
  const catName = (id: number | null) => categories.find((c: any) => c.id === id)?.name ?? "";

  return (
    <div>
      <h2>Movimientos</h2>
      <div className="card">
        <div className="row">
          <label>Mes: <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></label>
        </div>
      </div>

      <div className="card">
        <h3>Nuevo movimiento</h3>
        <div className="row">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="expense">Gasto</option>
            <option value="income">Ingreso</option>
            <option value="transfer">Transferencia</option>
          </select>
          <input type="number" placeholder="Monto" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">Cuenta…</option>
            {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Categoría…</option>
            {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input placeholder="Nota" value={note} onChange={(e) => setNote(e.target.value)} />
          <button onClick={add}>Agregar</button>
        </div>
      </div>

      <div className="card">
        <table>
          <thead><tr><th>Fecha</th><th>Tipo</th><th>Cuenta</th><th>Categoría</th><th>Nota</th><th>Monto</th><th></th></tr></thead>
          <tbody>
            {txns.map((t: any) => (
              <tr key={t.id}>
                <td>{t.date}</td>
                <td><span className="pill">{t.type}</span></td>
                <td>{accName(t.accountId)}</td>
                <td>{catName(t.categoryId)}</td>
                <td>{t.note}</td>
                <td style={{ color: t.type === "income" ? "var(--good)" : "var(--ink)" }}>
                  {t.type === "income" ? "+" : "−"}<Money cents={t.amount} />
                </td>
                <td><button className="danger" onClick={() => m.mutate({ path: `/api/transactions/${t.id}`, method: "DELETE" })}>✕</button></td>
              </tr>
            ))}
            {txns.length === 0 && <tr><td colSpan={7}><small>Sin movimientos este mes.</small></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
