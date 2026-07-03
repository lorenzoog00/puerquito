import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { IconHome, IconPig, IconList, IconMore, IconPlus } from "./Icons";

export function Layout() {
  const nav = useNavigate();
  return (
    <div className="app">
      <main className="app-main">
        <Outlet />
      </main>

      <nav className="tabbar">
        <NavLink to="/" end className="tab">
          <IconHome size={22} /><span>Inicio</span>
        </NavLink>
        <NavLink to="/ahorro" className="tab">
          <IconPig size={22} /><span>Ahorro</span>
        </NavLink>

        <button className="tab-add" onClick={() => nav("/registrar")} aria-label="Registrar">
          <IconPlus size={26} />
        </button>

        <NavLink to="/historial" className="tab">
          <IconList size={22} /><span>Historial</span>
        </NavLink>
        <NavLink to="/mas" className="tab">
          <IconMore size={22} /><span>Más</span>
        </NavLink>
      </nav>
    </div>
  );
}
