import { useState } from "react";
import { useAccounts, useMutate } from "../hooks";
import { Money } from "../components/Money";
import { SubHeader } from "../components/SubHeader";

const TYPES: [string, string][] = [
  ["cash", "Efectivo"],
  ["bank", "Banco"],
  ["card", "Tarjeta"],
  ["savings", "Ahorro"],
];

export function Accounts() {
  const { data: accounts = [] } = useAccounts();
  const m = useMutate(["accounts"]);
  const [name, setName] = useState("");
  const [type, setType] = useState("cash");
  const [start, setStart] = useState("0");
  const [editId, setEditId] = useState<number | null>(null);
  const [bal, setBal] = useState("");

  function add() {
    if (!name) return;
    m.mutate({ path: "/api/accounts", method: "POST", body: { name, type, startingBalance: Number(start) } });
    setName("");
    setStart("0");
  }

  function saveBalance(a: any) {
    const enteredPesos = Number(bal);
    if (Number.isNaN(enteredPesos)) return;
    const txnDeltaPesos = (a.balance - a.startingBalance) / 100; // net effect of existing txns
    const newStartingPesos = enteredPesos - txnDeltaPesos;
    m.mutate({ path: `/api/accounts/${a.id}`, method: "PATCH", body: { startingBalance: newStartingPesos } });
    setEditId(null);
  }

  return (
    <div className="screen">
      <SubHeader title="Cuentas" />
      <div className="card">
        {accounts.length === 0 && <small>Aún no tienes cuentas.</small>}
        {accounts.map((a: any) => (
          <div key={a.id} className="row" style={{ justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f1f1f4" }}>
            <span>{a.name} <span className="pill">{a.type}</span></span>
            <span className="row">
              <strong><Money cents={a.balance} /></strong>
              <button onClick={() => { setEditId(a.id); setBal(String(a.balance / 100)); }}>Ajustar</button>
              <button className="danger" onClick={() => m.mutate({ path: `/api/accounts/${a.id}`, method: "DELETE" })}>✕</button>
            </span>
            {editId === a.id && (
              <div className="row" style={{ padding: "8px 0" }}>
                <input type="number" value={bal} onChange={(e) => setBal(e.target.value)} placeholder="Saldo real" />
                <button onClick={() => saveBalance(a)}>Guardar</button>
                <button onClick={() => setEditId(null)}>Cancelar</button>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="card">
        <h3>Nueva cuenta</h3>
        <div className="row">
          <input placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <input type="number" value={start} onChange={(e) => setStart(e.target.value)} placeholder="Saldo inicial" />
          <button onClick={add}>Agregar</button>
        </div>
      </div>
    </div>
  );
}
