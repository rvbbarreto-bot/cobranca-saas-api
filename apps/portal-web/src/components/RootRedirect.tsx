import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export function RootRedirect(): JSX.Element {
  const { isAuthenticated } = useAuth();
  return <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />;
}
