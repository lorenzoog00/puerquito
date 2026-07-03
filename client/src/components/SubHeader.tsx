import { useNavigate } from "react-router-dom";
import { IconBack } from "./Icons";

export function SubHeader({ title }: { title: string }) {
  const nav = useNavigate();
  return (
    <header className="screen-head">
      <button className="icon-btn" onClick={() => nav("/mas")} aria-label="Volver"><IconBack /></button>
      <h2>{title}</h2>
    </header>
  );
}
