import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { PageErrorBoundary } from "../components/PageErrorBoundary";
import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../hooks/useTheme";
import { fetchPortalMe } from "../lib/api";
import { buildNavRenderList, isNavItemActive, navItemsForRole } from "../lib/portal-nav-access";
import type { PortalNavItem } from "../lib/portal-nav-access";

function navLinkItems(entries: ReturnType<typeof buildNavRenderList>): PortalNavItem[] {
  return entries.filter((e) => e.kind === "link").map((e) => e.item);
}

export function AppShell(): JSX.Element {
  const { logout, email: sessionEmail } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const me = useQuery({ queryKey: ["portalMe"], queryFn: fetchPortalMe, staleTime: 60_000 });

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!navOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") setNavOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [navOpen]);

  const displayName = me.data?.user.full_name?.trim() || me.data?.user.email || sessionEmail || "—";
  const roleLabel = me.data?.user.membership_role ?? "—";
  const navEntries = buildNavRenderList(navItemsForRole(me.data?.user.membership_role, me.data?.modules));
  const navLinks = navLinkItems(navEntries);

  function handleLogout(): void {
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className={`app-shell${navOpen ? " app-shell--nav-open" : ""}`}>
      {navOpen ? (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Fechar menu"
          onClick={() => setNavOpen(false)}
        />
      ) : null}
      <aside className={`sidebar${navOpen ? " sidebar--open" : ""}`}>
        <div className="sidebar__brand">
          <div className="sidebar__logo">EXEQ</div>
          <div className="sidebar__tag">Cobrança & Boletos</div>
        </div>
        <nav className="sidebar__nav">
          {navEntries.map((entry) =>
            entry.kind === "section" ? (
              <div key={`section-${entry.label}`} className="sidebar__section-label">
                {entry.label}
              </div>
            ) : (
              <NavLink
                key={entry.item.to}
                to={entry.item.to}
                className={`sidebar__link${
                  isNavItemActive(location.pathname, entry.item, navLinks) ? " sidebar__link--active" : ""
                }`}
              >
                {entry.item.label}
              </NavLink>
            )
          )}
        </nav>
        <button
          type="button"
          className="shell-theme-toggle"
          onClick={toggleTheme}
          aria-label={theme === "light" ? "Ativar tema escuro" : "Ativar tema claro"}
        >
          {theme === "light" ? "Tema escuro" : "Tema claro"}
        </button>
      </aside>
      <div className="shell-main">
        <header className="shell-header">
          <button
            type="button"
            className="shell-nav-toggle"
            aria-expanded={navOpen}
            aria-label={navOpen ? "Fechar menu" : "Abrir menu"}
            onClick={() => setNavOpen((open) => !open)}
          >
            Menu
          </button>
          <div className="shell-header__brand">
            <h1 className="shell-header__title">Portal SaaS de Cobrança</h1>
            <span className="shell-header__meta-inline">multiempresa · acesso restrito · rastreabilidade</span>
          </div>
          <div className="shell-header__user">
            <div className="shell-header__pill">
              <span className="shell-header__name">{displayName}</span>
              <span className="shell-header__role">{roleLabel}</span>
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
          <PageErrorBoundary>
            <Outlet />
          </PageErrorBoundary>
        </div>
      </div>
    </div>
  );
}
