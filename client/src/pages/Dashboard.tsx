import { Link, useNavigate } from "react-router-dom";
import { useAccounts, useTransactions, useSavings, useGoal, useGoals, usePresets, useSettings, useMutate } from "../hooks";
import { Money } from "../components/Money";
import { useToast } from "../toast";

function thisMonth() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function Dashboard() {
  const nav = useNavigate();
  const { data: accounts = [] } = useAccounts();
  const { data: txns = [] } = useTransactions(thisMonth());
  const { data: savings = [] } = useSavings();
  const { data: goal } = useGoal();
  const { data: goals = [] } = useGoals();
  const { data: presets = [] } = usePresets();
  const { data: settings } = useSettings();
  const logPreset = useMutate(["transactions", "accounts"]);
  const delTxn = useMutate(["transactions", "accounts"]);
  const mSav = useMutate(["savings", "accounts", "transactions"]);
  const mGoal = useMutate(["goals", "accounts", "transactions"]);
  const { notify } = useToast();

  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const half = now.getUTCDate() <= 15 ? 1 : 2;
  const ymKey = `${year}-${String(month).padStart(2, "0")}`;

  const disponible = accounts.filter((a: any) => a.type !== "savings").reduce((s: number, a: any) => s + a.balance, 0);
  const target = goal?.quincenaTarget ?? 0;

  // Build "esta quincena" checklist
  const savEntry = savings.find((e: any) => e.year === year && e.month === month && e.quincenaHalf === half);
  const ahorroDone = !!savEntry;

  function toggleAhorro() {
    if (ahorroDone) {
      mSav.mutate({ path: `/api/savings/entries/${savEntry.id}`, method: "DELETE" });
    } else {
      mSav.mutate({ path: "/api/savings/entries", method: "POST", body: { year, month, quincenaHalf: half, amountSaved: target / 100 } });
    }
  }

  const goalItems = goals.filter((g: any) => g.monthlyAmount > 0).map((g: any) => ({
    g, done: (g.contributedMonths || []).includes(ymKey),
  }));

  function toggleGoal(g: any, done: boolean) {
    if (done) mGoal.mutate({ path: `/api/goals/${g.id}/check?year=${year}&month=${month}`, method: "DELETE" });
    else mGoal.mutate({ path: `/api/goals/${g.id}/check`, method: "POST", body: { year, month } });
  }

  const doneCount = (ahorroDone ? 1 : 0) + goalItems.filter((i: any) => i.done).length;
  const totalCount = 1 + goalItems.length;

  const items = [
    { key: "ahorro", label: "Ahorrar", amount: target, done: ahorroDone, toggle: toggleAhorro },
    ...goalItems.map(({ g, done }: any) => ({
      key: "g" + g.id, label: `Abonar a ${g.name}`, amount: g.monthlyAmount, done, toggle: () => toggleGoal(g, done),
    })),
  ];
  const pendientes = items.filter((i) => !i.done);
  const hechos = items.filter((i) => i.done);
  const renderItem = (it: any) => (
    <button key={it.key} className={"check-item " + (it.done ? "done" : "")} onClick={it.toggle}>
      <span className="check-circle">{it.done ? "✓" : ""}</span>
      <span className="check-label">{it.label}</span>
      <span className="check-amount"><Money cents={it.amount} /></span>
    </button>
  );

  function tapPreset(p: any) {
    logPreset.mutate(
      { path: `/api/presets/${p.id}/log`, method: "POST" },
      { onSuccess: (row: any) => notify(`${p.label} registrado`, () => delTxn.mutate({ path: `/api/transactions/${row.id}`, method: "DELETE" })) }
    );
  }

  const recent = [...txns].slice(0, 4);
  const name = settings?.ownerName;

  return (
    <div className="screen">
      <header className="screen-head col">
        <span className="muted">{now.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" })}</span>
        <h2>{name ? `Hola, ${name}` : "Inicio"}</h2>
      </header>

      <div className="hero card">
        <span className="hero-label">Dinero disponible</span>
        <div className="hero-value"><Money cents={disponible} /></div>
        <span className="muted">Lo que puedes gastar sin tocar tu ahorro</span>
      </div>

      {disponible === 0 && (
        <Link to="/accounts" className="card" style={{ display: "block", textAlign: "center" }}>
          Configura los saldos de tus cuentas →
        </Link>
      )}

      <div className="card">
        <div className="between" style={{ marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>Esta quincena</h3>
          <span className="pill">{doneCount} de {totalCount}</span>
        </div>

        {pendientes.map(renderItem)}

        {pendientes.length === 0 && <p className="done-all">¡Todo listo este mes!</p>}

        {hechos.length > 0 && <div className="done-label">Pagado este mes</div>}
        {hechos.map(renderItem)}

        {goalItems.length === 0 && <p className="muted" style={{ margin: "8px 0 0" }}>Agrega metas en la pestaña Metas para verlas aquí.</p>}
      </div>

      <button className="big-log" onClick={() => nav("/registrar")}>+ Registrar gasto</button>

      {presets.length > 0 && (
        <div className="preset-row">
          {presets.map((p: any) => (
            <button key={p.id} className={"preset " + (p.type === "income" ? "preset-in" : "")}
              disabled={logPreset.isPending} onClick={() => tapPreset(p)}>
              <span className="preset-label">{p.label}</span>
              <span className="preset-amount">{p.type === "income" ? "+" : ""}<Money cents={p.amount} /></span>
            </button>
          ))}
        </div>
      )}

      <div className="card">
        <div className="between" style={{ marginBottom: 6 }}>
          <h3 style={{ margin: 0 }}>Últimos movimientos</h3>
          <Link to="/historial" className="link">Ver todo ›</Link>
        </div>
        {recent.map((t: any) => (
          <div key={t.id} className="between goal-row">
            <span>{t.name || t.note || t.type} <span className="muted" style={{ fontSize: 13 }}>· {t.date.slice(5)}</span></span>
            <span style={{ color: t.type === "income" ? "var(--good)" : "var(--ink)", fontWeight: 600 }}>
              {t.type === "income" ? "+" : "−"}<Money cents={t.amount} />
            </span>
          </div>
        ))}
        {recent.length === 0 && <p className="muted" style={{ margin: "4px 0 0" }}>Aún no hay movimientos.</p>}
      </div>
    </div>
  );
}
