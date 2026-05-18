import { useQuery } from "@tanstack/react-query";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { fetchPortalMe } from "../lib/api";

const navCls = ({ isActive }: { isActive: boolean }): string =>
  `sidebar__link${isActive ? " sidebar__link--active" : ""}`;

export function AppShell(): JSX.Element {
  const { logout, email: sessionEmail } = useAuth();
  const navigate = useNavigate();
  const me = useQuery({ queryKey: ["portalMe"], queryFn: fetchPortalMe, staleTime: 60_000 });

  const displayName = me.data?.user.full_name?.trim() || me.data?.user.email || sessionEmail || "—";
  const roleLabel = me.data?.user.membership_role ?? "—";

  function handleLogout(): void {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <div className="sidebar__logo">EXEQ</div>
          <div className="sidebar__tag">Cobrança & Boletos</div>
        </div>
        <nav className="sidebar__nav">
          <NavLink to="/dashboard" className={navCls}>
            Dashboard
          </NavLink>
          <NavLink to="/clientes" className={navCls}>
            Clientes
          </NavLink>
          <NavLink to="/cobrancas" className={navCls}>
            Boletos
          </NavLink>
          <NavLink to="/recorrente" className={navCls}>
            Cobrança recorrente
          </NavLink>
          <NavLink to="/notificacoes" className={navCls}>
            Notificações
          </NavLink>
          <NavLink to="/auditoria" className={navCls}>
            Auditoria
          </NavLink>
          <NavLink to="/configuracoes" className={navCls}>
            Configurações
          </NavLink>
          <div className="sidebar__section-label">Ferramentas</div>
          <NavLink to="/notas-fiscais" className={navCls}>
            Notas fiscais
          </NavLink>
          <NavLink to="/relatorios" className={navCls}>
            Relatórios / CSV
          </NavLink>
          <NavLink to="/escritorio" className={navCls}>
            Escritório
          </NavLink>
          <NavLink to="/ajuda/provisionamento-core" className={navCls}>
            Ajuda (core)
          </NavLink>
        </nav>
      </aside>
      <div className="shell-main">
        <header className="shell-header">
          <div>
            <h1 className="shell-header__title">Portal SaaS de Cobrança</h1>
            <p className="shell-header__meta">operação multiempresa · acesso restrito · rastreabilidade</p>
          </div>
          <div className="shell-header__user">
            <div className="shell-header__pill">
              <div className="shell-header__name">{displayName}</div>
              <div className="shell-header__role">{roleLabel}</div>
            </div>
            <button type="button" className="shell-header__logout" onClick={handleLogout}>
              Sair
            </button>
          </div>
        </header>
        {me.isError ? (
          <div className="shell-banner shell-banner--warn">
            Não foi possível carregar o perfil ({me.error instanceof Error ? me.error.message : "erro"}). O cabeçalho
            usa dados da sessão.
          </div>
        ) : null}
        <div className="shell-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
