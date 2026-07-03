import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth";

const links: [string, string][] = [
  ["/", "Inicio"],
  ["/transactions", "Movimientos"],
  ["/budgets", "Presupuestos"],
  ["/accounts", "Cuentas"],
  ["/recurring", "Recurrentes"],
  ["/ahorro", "Ahorro"],
  ["/ajustes", "Ajustes"],
];

export function Layout() {
  const { logout } = useAuth();
  return (
    <div className="layout">
      <nav className="sidebar">
        <div className="brand">Puerquito</div>
        {links.map(([to, label]) => (
          <NavLink key={to} to={to} end={to === "/"}>
            {label}
          </NavLink>
        ))}
        <button onClick={logout} className="logout">Salir</button>
      </nav>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
