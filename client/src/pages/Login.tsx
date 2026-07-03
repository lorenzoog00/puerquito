import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth";

export function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await login(email, password);
      nav("/");
    } catch {
      setErr("Credenciales incorrectas");
    }
  }
  return (
    <div style={{ maxWidth: 340, margin: "80px auto" }}>
      <div className="card">
        <h1 style={{ fontSize: 28 }}>Puerquito 🐷</h1>
        <p style={{ color: "#6b7280", marginTop: -4 }}>Tus finanzas personales</p>
        <form onSubmit={submit} style={{ display: "grid", gap: 12, marginTop: 12 }}>
          <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input placeholder="Contraseña" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {err && <div style={{ color: "#dc2626" }}>{err}</div>}
          <button type="submit">Entrar</button>
        </form>
      </div>
    </div>
  );
}
