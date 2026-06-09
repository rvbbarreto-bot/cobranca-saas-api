import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { hasExeqSession } from "../lib/exeq-api";

export function RootRedirect(): JSX.Element {
  const { isAuthenticated: portalAuth } = useAuth();
  if (hasExeqSession()) {
    return <Navigate to="/exeq/escritorios" replace />;
  }
  if (portalAuth) {
    return <Navigate to="/dashboard" replace />;
  }
  return <Navigate to="/login" replace />;
}
