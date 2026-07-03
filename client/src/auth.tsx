import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { api } from "./api";

type AuthCtx = {
  email: string | null;
  loading: boolean;
  login: (e: string, p: string) => Promise<void>;
  logout: () => Promise<void>;
};
const Ctx = createContext<AuthCtx>(null!);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api("/api/auth/me")
      .then((u: any) => setEmail(u.email))
      .catch(() => setEmail(null))
      .finally(() => setLoading(false));
  }, []);
  async function login(e: string, p: string) {
    await api("/api/auth/login", { method: "POST", body: JSON.stringify({ email: e, password: p }) });
    setEmail(e);
  }
  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    setEmail(null);
  }
  return <Ctx.Provider value={{ email, loading, login, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { email, loading } = useAuth();
  if (loading) return <div style={{ padding: 24 }}>Cargando…</div>;
  return email ? <>{children}</> : <Navigate to="/login" replace />;
}
