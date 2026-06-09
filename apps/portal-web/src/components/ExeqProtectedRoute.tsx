import { Navigate, Outlet } from "react-router-dom";
import { useExeqAuth } from "../hooks/useExeqAuth";

export function ExeqProtectedRoute(): JSX.Element {
  const { isAuthenticated } = useExeqAuth();
  if (!isAuthenticated && !hasExeqSession()) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}
