/** Papéis do portal (API: portal.membership.role). */
export type PortalStaffRole = "admin_escritorio" | "operador";

export type PortalModuleKey =
  | "cobranca"
  | "clientes"
  | "notas_fiscais"
  | "fiscal_guias"
  | "relatorios";

export type PortalModuleFlags = Record<PortalModuleKey, boolean>;

export type PortalNavItem = {
  to: string;
  label: string;
  section?: "ferramentas";
  roles: PortalStaffRole[];
  /** Módulo EXEQ necessário; omitido = sempre visível para o papel. */
  module?: PortalModuleKey;
};

import { isFiscalGuiasNavEnabled } from "./fiscal-feature";

/** Itens do menu lateral — admin vê tudo; operador só o subset operacional. */
export const PORTAL_NAV_ITEMS: PortalNavItem[] = [
  { to: "/dashboard", label: "Dashboard", roles: ["admin_escritorio", "operador"] },
  { to: "/clientes", label: "Clientes", roles: ["admin_escritorio", "operador"], module: "clientes" },
  { to: "/cobrancas", label: "Boletos", roles: ["admin_escritorio", "operador"], module: "cobranca" },
  ...(isFiscalGuiasNavEnabled()
    ? [
        {
          to: "/fiscal/dashboard",
          label: "Dashboard fiscal",
          roles: ["admin_escritorio", "operador"] as PortalStaffRole[],
          module: "fiscal_guias" as PortalModuleKey
        },
        {
          to: "/processamentos-fiscais/importar",
          label: "Importar PGDASD",
          roles: ["admin_escritorio", "operador"] as PortalStaffRole[],
          module: "fiscal_guias" as PortalModuleKey
        },
        {
          to: "/processamentos-fiscais",
          label: "Processamentos PGDASD",
          roles: ["admin_escritorio", "operador"] as PortalStaffRole[],
          module: "fiscal_guias" as PortalModuleKey
        },
        {
          to: "/fiscal/erros",
          label: "Erros fiscais",
          roles: ["admin_escritorio", "operador"] as PortalStaffRole[],
          module: "fiscal_guias" as PortalModuleKey
        },
        {
          to: "/guias-fiscais",
          label: "Guias fiscais (DAS/DARF)",
          roles: ["admin_escritorio", "operador"] as PortalStaffRole[],
          module: "fiscal_guias" as PortalModuleKey
        },
        {
          to: "/fiscal/certificados",
          label: "Certificados A1",
          roles: ["admin_escritorio"] as PortalStaffRole[],
          module: "fiscal_guias" as PortalModuleKey
        },
        {
          to: "/fiscal/procuracoes",
          label: "Procurações",
          roles: ["admin_escritorio"] as PortalStaffRole[],
          module: "fiscal_guias" as PortalModuleKey
        },
        {
          to: "/configuracoes/fiscal",
          label: "Config. fiscal",
          roles: ["admin_escritorio"] as PortalStaffRole[],
          module: "fiscal_guias" as PortalModuleKey
        }
      ]
    : []),
  { to: "/recorrente", label: "Cobrança recorrente", roles: ["admin_escritorio", "operador"], module: "cobranca" },
  { to: "/notificacoes", label: "Notificações", roles: ["admin_escritorio"] },
  ...(isFiscalGuiasNavEnabled()
    ? [{ to: "/auditoria", label: "Auditoria fiscal", roles: ["admin_escritorio"] as PortalStaffRole[] }]
    : [{ to: "/auditoria", label: "Auditoria", roles: ["admin_escritorio"] as PortalStaffRole[] }]),
  { to: "/configuracoes", label: "Configurações", roles: ["admin_escritorio"] },
  {
    to: "/notas-fiscais",
    label: "Notas fiscais",
    section: "ferramentas",
    roles: ["admin_escritorio"],
    module: "notas_fiscais"
  },
  {
    to: "/relatorios",
    label: "Relatórios / CSV",
    section: "ferramentas",
    roles: ["admin_escritorio"],
    module: "relatorios"
  },
  { to: "/escritorio", label: "Escritório", section: "ferramentas", roles: ["admin_escritorio"] },
  {
    to: "/ajuda/provisionamento-core",
    label: "Ajuda (core)",
    section: "ferramentas",
    roles: ["admin_escritorio"]
  }
];

const DEFAULT_MODULES: PortalModuleFlags = {
  cobranca: true,
  clientes: true,
  notas_fiscais: true,
  fiscal_guias: false,
  relatorios: true
};

function isModuleEnabled(modules: PortalModuleFlags | undefined, moduleKey: PortalModuleKey | undefined): boolean {
  if (!moduleKey) {
    return true;
  }
  const flags = modules ?? DEFAULT_MODULES;
  return flags[moduleKey] !== false;
}

export function navItemsForRole(
  role: string | undefined,
  modules?: PortalModuleFlags
): PortalNavItem[] {
  let byRole: PortalNavItem[];
  if (!role || role === "admin_escritorio") {
    byRole = PORTAL_NAV_ITEMS;
  } else if (role === "operador") {
    byRole = PORTAL_NAV_ITEMS.filter((item) => item.roles.includes("operador"));
  } else {
    byRole = PORTAL_NAV_ITEMS;
  }
  return byRole.filter((item) => isModuleEnabled(modules, item.module));
}

export function buildNavRenderList(
  items: PortalNavItem[]
): Array<{ kind: "section"; label: string } | { kind: "link"; item: PortalNavItem }> {
  const out: Array<{ kind: "section"; label: string } | { kind: "link"; item: PortalNavItem }> = [];
  let ferramentasHeader = false;
  for (const item of items) {
    if (item.section === "ferramentas" && !ferramentasHeader) {
      out.push({ kind: "section", label: "Ferramentas" });
      ferramentasHeader = true;
    }
    out.push({ kind: "link", item });
  }
  return out;
}

/** Itens cujo `to` casa com a rota (exato ou filho). */
export function navItemsMatchingPath(pathname: string, items: PortalNavItem[]): PortalNavItem[] {
  return items.filter((item) => pathname === item.to || pathname.startsWith(`${item.to}/`));
}

/**
 * Um único item ativo por rota — vence o prefixo mais longo.
 * Evita duplo highlight (ex.: Importar + Processamentos em /processamentos-fiscais/importar).
 */
export function resolveActiveNavItem(pathname: string, items: PortalNavItem[]): PortalNavItem | null {
  const matches = navItemsMatchingPath(pathname, items);
  if (matches.length === 0) {
    return null;
  }
  return matches.reduce((best, cur) => (cur.to.length > best.to.length ? cur : best));
}

export function isNavItemActive(
  pathname: string,
  item: PortalNavItem,
  visibleItems: PortalNavItem[]
): boolean {
  return resolveActiveNavItem(pathname, visibleItems)?.to === item.to;
}

/** Bloqueia URL direta fora do papel (operador) ou módulo desabilitado. */
export function isPortalPathAllowedForRole(
  pathname: string,
  role: string | undefined,
  modules?: PortalModuleFlags
): boolean {
  const allowed = navItemsForRole(role, modules);
  return allowed.some((item) => pathname === item.to || pathname.startsWith(`${item.to}/`));
}

/** Mapeia rota para módulo (guard de URL). */
export function moduleForPortalPath(pathname: string): PortalModuleKey | null {
  const match = PORTAL_NAV_ITEMS.find(
    (item) => item.module && (pathname === item.to || pathname.startsWith(`${item.to}/`))
  );
  return match?.module ?? null;
}
