import { useState } from "react";
import { useRecurring, useAccounts, useMutate } from "../hooks";
import { Money } from "../components/Money";

export function Recurring() {
  const { data: recs = [] } = useRecurring();
  const { data: accounts = [] } = useAccounts();
  const m = useMutate(["recurring", "transactions", "accounts"]);

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [frequency, setFrequency] = useState("monthly");
  const [nextDueDate, setNextDueDate] = useState(new Date().toISOString().slice(0, 10));

  function add() {
    if (!name || !amount || !accountId) return;
    m.mutate({
      path: "/api/recurring",
      method: "POST",
      body: { name, amount: Number(amount), accountId: Number(accountId), frequency, nextDueDate },
    });
    setName("");
    setAmount("");
  }

  const accName = (id: number) => accounts.find((a: any) => a.id === id)?.name ?? "—";

  return (
    <div>
      <h2>Pagos recurrentes</h2>
      <div className="card">
        <table>
          <thead><tr><th>Nombre</th><th>Monto</th><th>Cuenta</th><th>Frecuencia</th><th>Próximo</th><th></th></tr></thead>
          <tbody>
            {recs.map((r: any) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td><Money cents={r.amount} /></td>
                <td>{accName(r.accountId)}</td>
                <td>{r.frequency === "monthly" ? "Mensual" : "Semanal"}</td>
                <td>{r.nextDueDate}</td>
                <td className="row">
                  <button onClick={() => m.mutate({ path: `/api/recurring/${r.id}/pay`, method: "POST" })}>Pagar</button>
                  <button className="danger" onClick={() => m.mutate({ path: `/api/recurring/${r.id}`, method: "DELETE" })}>✕</button>
                </td>
              </tr>
            ))}
            {recs.length === 0 && <tr><td colSpan={6}><small>Sin pagos recurrentes.</small></td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>Nuevo recurrente</h3>
        <div className="row">
          <input placeholder="Nombre (ej. Renta)" value={name} onChange={(e) => setName(e.target.value)} />
          <input type="number" placeholder="Monto" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">Cuenta…</option>
            {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select value={frequency} onChange={(e) => setFrequency(e.target.value)}>
            <option value="monthly">Mensual</option>
            <option value="weekly">Semanal</option>
          </select>
          <input type="date" value={nextDueDate} onChange={(e) => setNextDueDate(e.target.value)} />
          <button onClick={add}>Agregar</button>
        </div>
      </div>
    </div>
  );
}
