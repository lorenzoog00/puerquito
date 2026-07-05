import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAccounts, useCategories, usePresets, useMutate } from "../hooks";
import { Money } from "../components/Money";
import { IconBack } from "../components/Icons";
import { useToast } from "../toast";

export function Registrar() {
  const nav = useNavigate();
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const { data: presets = [] } = usePresets();
  const logPreset = useMutate(["transactions", "accounts"]);
  const addTxn = useMutate(["transactions", "accounts"]);
  const delTxn = useMutate(["transactions", "accounts"]);
  const { notify } = useToast();

  const [cents, setCents] = useState(0);
  const [type, setType] = useState("expense");
  const [accountId, setAccountId] = useState<number | "">("");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");

  // default account: first card for expense, first bank for income
  const defaultAcc =
    accounts.find((a: any) => (type === "income" ? a.type === "bank" : a.type === "card"))?.id ??
    accounts[0]?.id ?? "";
  const acc = accountId || defaultAcc;

  const cats = categories.filter((c: any) => c.type === type);

  function press(d: string) {
    if (d === "del") return setCents((c) => Math.floor(c / 10));
    if (d === "00") return setCents((c) => Math.min(c * 100, 99999999));
    setCents((c) => Math.min(c * 10 + Number(d), 99999999));
  }

  function save() {
    if (cents <= 0 || !acc || !name.trim()) return;
    addTxn.mutate(
      {
        path: "/api/transactions",
        method: "POST",
        body: {
          date: new Date().toISOString().slice(0, 10),
          name: name.trim(),
          amount: cents / 100,
          accountId: Number(acc),
          categoryId: categoryId ? Number(categoryId) : null,
          type,
        },
      },
      {
        onSuccess: (row: any) => {
          notify("Movimiento registrado", () => delTxn.mutate({ path: `/api/transactions/${row.id}`, method: "DELETE" }));
          nav("/");
        },
      }
    );
  }

  function tapPreset(id: number, label: string) {
    logPreset.mutate(
      { path: `/api/presets/${id}/log`, method: "POST" },
      {
        onSuccess: (row: any) => {
          notify(`${label} registrado`, () => delTxn.mutate({ path: `/api/transactions/${row.id}`, method: "DELETE" }));
          nav("/");
        },
      }
    );
  }

  return (
    <div className="screen">
      <header className="screen-head">
        <button className="icon-btn" onClick={() => nav(-1)}><IconBack /></button>
        <h2>Registrar</h2>
      </header>

      {presets.length > 0 && (
        <div className="preset-row" style={{ marginBottom: 18 }}>
          {presets.map((p: any) => (
            <button key={p.id} className={"preset " + (p.type === "income" ? "preset-in" : "")}
              disabled={logPreset.isPending} onClick={() => tapPreset(p.id, p.label)}>
              <span className="preset-label">{p.label}</span>
              <span className="preset-amount">{p.type === "income" ? "+" : ""}<Money cents={p.amount} /></span>
            </button>
          ))}
        </div>
      )}

      <input
        className="acc-select"
        placeholder="Nombre (ej. Tacos, Uber)"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <div className="amount-display"><Money cents={cents} /></div>

      <div className="seg">
        <button className={type === "expense" ? "on" : ""} onClick={() => { setType("expense"); setCategoryId(""); }}>Gasto</button>
        <button className={type === "income" ? "on" : ""} onClick={() => { setType("income"); setCategoryId(""); }}>Ingreso</button>
      </div>

      <div className="chips">
        {cats.map((c: any) => (
          <button key={c.id} className={"chip " + (categoryId === c.id ? "on" : "")}
            onClick={() => setCategoryId(c.id)}>{c.name}</button>
        ))}
      </div>

      <select className="acc-select" value={acc} onChange={(e) => setAccountId(Number(e.target.value))}>
        {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>

      <div className="keypad">
        {["1","2","3","4","5","6","7","8","9","00","0","del"].map((k) => (
          <button key={k} className="key" onClick={() => press(k)}>{k === "del" ? "⌫" : k}</button>
        ))}
      </div>

      <button className="save-btn" disabled={cents <= 0 || !name.trim() || addTxn.isPending} onClick={save}>
        Guardar
      </button>
    </div>
  );
}
