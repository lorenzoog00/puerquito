import { Link } from "react-router-dom";
import { useAuth } from "../auth";

const items: [string, string, string][] = [
  ["/accounts", "Cuentas", "Saldos de tus cuentas y tarjetas"],
  ["/recurring", "Recurrentes", "Pagos y suscripciones que se repiten"],
  ["/budgets", "Presupuestos", "Límites de gasto por categoría"],
  ["/ajustes", "Ajustes", "Tu nombre, metas de ahorro y accesos rápidos"],
];

export function Mas() {
  const { logout } = useAuth();
  return (
    <div className="screen">
      <header className="screen-head"><h2>Más</h2></header>
      <div className="menu">
        {items.map(([to, title, sub]) => (
          <Link key={to} to={to} className="menu-item">
            <div>
              <div className="menu-title">{title}</div>
              <div className="menu-sub">{sub}</div>
            </div>
            <span className="menu-chev">›</span>
          </Link>
        ))}
      </div>
      <button className="logout" onClick={logout}>Cerrar sesión</button>
    </div>
  );
}
