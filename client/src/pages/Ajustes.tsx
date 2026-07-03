import { useState } from "react";
import { usePresets, useSettings, useGoal, useAccounts, useCategories, useMutate } from "../hooks";
import { Money } from "../components/Money";
import { SubHeader } from "../components/SubHeader";

export function Ajustes() {
  const { data: settings } = useSettings();
  const { data: goal } = useGoal();
  const { data: presets = [] } = usePresets();
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const mSettings = useMutate(["settings"]);
  const mGoal = useMutate(["goal"]);
  const mPreset = useMutate(["presets"]);

  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("expense");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");

  function addPreset() {
    if (!label || !amount || !accountId) return;
    mPreset.mutate({
      path: "/api/presets",
      method: "POST",
      body: { label, amount: Number(amount), type, accountId: Number(accountId), categoryId: categoryId ? Number(categoryId) : null },
    });
    setLabel(""); setAmount("");
  }

  const accName = (id: number) => accounts.find((a: any) => a.id === id)?.name ?? "—";

  return (
    <div className="screen">
      <SubHeader title="Ajustes" />

      <div className="grid">
        <div className="card">
          <h3>Tu nombre</h3>
          <input
            defaultValue={settings?.ownerName ?? ""}
            placeholder="Nombre"
            onBlur={(e) => mSettings.mutate({ path: "/api/settings", method: "PUT", body: { ownerName: e.target.value || null } })}
          />
          <span className="muted">Aparece en el saludo del inicio.</span>
        </div>
        <div className="card">
          <h3>Metas de ahorro</h3>
          <label className="field">Por quincena
            <input type="number" defaultValue={goal ? goal.quincenaTarget / 100 : 0}
              onBlur={(e) => mGoal.mutate({ path: "/api/savings/goal", method: "PUT", body: { quincenaTarget: Number(e.target.value), overallGoal: goal?.overallGoal ? goal.overallGoal / 100 : null } })} />
          </label>
          <label className="field">Meta total
            <input type="number" defaultValue={goal?.overallGoal ? goal.overallGoal / 100 : ""}
              onBlur={(e) => mGoal.mutate({ path: "/api/savings/goal", method: "PUT", body: { quincenaTarget: goal ? goal.quincenaTarget / 100 : 0, overallGoal: e.target.value ? Number(e.target.value) : null } })} />
          </label>
        </div>
      </div>

      <div className="card">
        <h3>Accesos rápidos</h3>
        <table>
          <tbody>
            {presets.map((p: any) => (
              <tr key={p.id}>
                <td>{p.label}</td>
                <td><span className={"pill " + (p.type === "income" ? "pill-in" : "")}>{p.type === "income" ? "ingreso" : "gasto"}</span></td>
                <td className="muted">{accName(p.accountId)}</td>
                <td className="right"><Money cents={p.amount} /></td>
                <td className="right"><button className="danger" onClick={() => mPreset.mutate({ path: `/api/presets/${p.id}`, method: "DELETE" })}>Eliminar</button></td>
              </tr>
            ))}
            {presets.length === 0 && <tr><td className="muted">Sin accesos rápidos.</td></tr>}
          </tbody>
        </table>
        <div className="row" style={{ marginTop: 12 }}>
          <input placeholder="Nombre (ej. Café)" value={label} onChange={(e) => setLabel(e.target.value)} />
          <input type="number" placeholder="Monto" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="expense">Gasto</option>
            <option value="income">Ingreso</option>
          </select>
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">Cuenta…</option>
            {accounts.map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Categoría…</option>
            {categories.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button onClick={addPreset}>Agregar</button>
        </div>
      </div>
    </div>
  );
}
