import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { PageErrorBoundary } from "../components/PageErrorBoundary";
import { useExeqAuth } from "../hooks/useExeqAuth";
import { fetchExeqMe } from "../lib/exeq-api";

const navCls = ({ isActive }: { isActive: boolean }): string =>
  `exeq-sidebar__link${isActive ? " exeq-sidebar__link--active" : ""}`;

export function ExeqShell(): JSX.Element {
  const { logout, email: sessionEmail } = useExeqAuth();
  const navigate = useNavigate();
  const me = useQuery({ queryKey: ["exeqMe"], queryFn: fetchExeqMe, staleTime: 60_000 });

  const displayName = me.data?.user.full_name?.trim() || me.data?.user.email || sessionEmail || "—";

  function handleLogout(): void {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="exeq-app-shell">
      <aside className="exeq-sidebar">
        <div className="exeq-sidebar__brand">
          <div className="exeq-sidebar__logo">EXEQ</div>
          <div className="exeq-sidebar__tag">Console Master</div>
          <p className="exeq-sidebar__hint">Governança multi-escritório · RBAC · módulos</p>
        </div>
        <nav className="exeq-sidebar__nav">
          <NavLink to="/exeq/escritorios" className={navCls} end>
            Escritórios
          </NavLink>
          <NavLink to="/exeq/escritorios/novo" className={navCls}>
            Novo escritório
          </NavLink>
        </nav>
        <a className="exeq-sidebar__portal-link" href="/login">
          Ir ao portal do escritório →
        </a>
      </aside>
      <div className="exeq-shell-main">
        <header className="exeq-shell-header">
          <div>
            <h1 className="exeq-shell-header__title">Plataforma EXEQ</h1>
            <p className="exeq-shell-header__meta">Acesso restrito · operadores internos</p>
          </div>
          <div className="exeq-shell-header__user">
            <div className="exeq-shell-header__pill">
              <div className="exeq-shell-header__name">{displayName}</div>
              <div className="exeq-shell-header__role">Platform Master</div>
            </div>
            <button type="button" className="exeq-shell-header__logout" onClick={handleLogout}>
              Sair
            </button>
          </div>
        </header>
        <div className="exeq-shell-content">
          <PageErrorBoundary>
            <Outlet />
          </PageErrorBoundary>
        </div>
      </div>
    </div>
  );
}
