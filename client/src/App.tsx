import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider, ProtectedRoute } from "./auth";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Registrar } from "./pages/Registrar";
import { Transactions } from "./pages/Transactions";
import { Budgets } from "./pages/Budgets";
import { Accounts } from "./pages/Accounts";
import { Recurring } from "./pages/Recurring";
import { Ahorro } from "./pages/Ahorro";
import { Ajustes } from "./pages/Ajustes";
import { Mas } from "./pages/Mas";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/registrar" element={<Registrar />} />
            <Route path="/ahorro" element={<Ahorro />} />
            <Route path="/historial" element={<Transactions />} />
            <Route path="/mas" element={<Mas />} />
            <Route path="/accounts" element={<Accounts />} />
            <Route path="/recurring" element={<Recurring />} />
            <Route path="/budgets" element={<Budgets />} />
            <Route path="/ajustes" element={<Ajustes />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
