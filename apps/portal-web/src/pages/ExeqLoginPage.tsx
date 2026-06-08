import { Navigate } from "react-router-dom";

/** Login unificado em /login — redireciona rota legada. */
export function ExeqLoginPage(): JSX.Element {
  return <Navigate to="/login" replace />;
}
