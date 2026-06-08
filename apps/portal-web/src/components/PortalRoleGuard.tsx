import { useQuery } from "@tanstack/react-query";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { fetchPortalMe } from "../lib/api";
import { isPortalPathAllowedForRole } from "../lib/portal-nav-access";

/** Redireciona operador que acessa rota só de admin (ex.: /configuracoes). */
export function PortalRoleGuard(): JSX.Element {
  const location = useLocation();
  const me = useQuery({ queryKey: ["portalMe"], queryFn: fetchPortalMe, staleTime: 60_000 });

  if (me.isLoading) {
    return <p className="muted">A carregar perfil…</p>;
  }

  const role = me.data?.user.membership_role;
  const modules = me.data?.modules;
  if (role && !isPortalPathAllowedForRole(location.pathname, role, modules)) {
    return <Navigate to="/dashboard" replace state={{ forbiddenFrom: location.pathname }} />;
  }

  return <Outlet />;
}
