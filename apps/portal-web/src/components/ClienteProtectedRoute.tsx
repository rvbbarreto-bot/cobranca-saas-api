import { Navigate, Outlet } from "react-router-dom";
import { hasClienteSession } from "../lib/api";

export function ClienteProtectedRoute(): JSX.Element {
  if (!hasClienteSession()) {
    return <Navigate to="/acesso" replace />;
  }
  return <Outlet />;
}
