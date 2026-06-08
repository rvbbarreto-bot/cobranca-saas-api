import { describe, expect, it } from "vitest";
import {
  isNavItemActive,
  isPortalPathAllowedForRole,
  navItemsForRole,
  resolveActiveNavItem
} from "./portal-nav-access";

const FISCAL_NAV = [
  { to: "/processamentos-fiscais/importar", label: "Importar PGDASD", roles: ["admin_escritorio", "operador"] as const },
  { to: "/processamentos-fiscais", label: "Processamentos PGDASD", roles: ["admin_escritorio", "operador"] as const },
  { to: "/guias-fiscais", label: "Guias fiscais", roles: ["admin_escritorio", "operador"] as const },
  { to: "/configuracoes/fiscal", label: "Config. fiscal", roles: ["admin_escritorio"] as const }
];

const CORE_NAV = [
  { to: "/dashboard", label: "Dashboard", roles: ["admin_escritorio", "operador"] as const },
  { to: "/clientes", label: "Clientes", roles: ["admin_escritorio", "operador"] as const },
  { to: "/cobrancas", label: "Boletos", roles: ["admin_escritorio", "operador"] as const },
  { to: "/configuracoes", label: "Configurações", roles: ["admin_escritorio"] as const }
];

const ALL_NAV = [...CORE_NAV, ...FISCAL_NAV];

describe("portal-nav-access", () => {
  it("admin vê todos os itens do menu", () => {
    expect(navItemsForRole("admin_escritorio")).toHaveLength(11);
  });

  it("operador vê dashboard, clientes, boletos e recorrente", () => {
    const items = navItemsForRole("operador");
    expect(items.map((i) => i.to)).toEqual(["/dashboard", "/clientes", "/cobrancas", "/recorrente"]);
  });

  it("operador não acessa configuracoes por URL", () => {
    expect(isPortalPathAllowedForRole("/configuracoes", "operador")).toBe(false);
    expect(isPortalPathAllowedForRole("/cobrancas/nova", "operador")).toBe(true);
  });

  it("admin acessa qualquer rota", () => {
    expect(isPortalPathAllowedForRole("/configuracoes", "admin_escritorio")).toBe(true);
  });

  it("filtra modulos desabilitados para admin", () => {
    const items = navItemsForRole("admin_escritorio", {
      cobranca: true,
      clientes: false,
      notas_fiscais: false,
      fiscal_guias: false,
      relatorios: false
    });
    expect(items.some((i) => i.to === "/clientes")).toBe(false);
    expect(items.some((i) => i.to === "/cobrancas")).toBe(true);
  });
});

describe("resolveActiveNavItem — prefixo mais específico", () => {
  it("Importar PGDASD: só importar ativo (não processamentos)", () => {
    const active = resolveActiveNavItem("/processamentos-fiscais/importar", ALL_NAV);
    expect(active?.to).toBe("/processamentos-fiscais/importar");
    expect(isNavItemActive("/processamentos-fiscais/importar", FISCAL_NAV[0], ALL_NAV)).toBe(true);
    expect(isNavItemActive("/processamentos-fiscais/importar", FISCAL_NAV[1], ALL_NAV)).toBe(false);
  });

  it("lista processamentos: só processamentos ativo", () => {
    expect(resolveActiveNavItem("/processamentos-fiscais", ALL_NAV)?.to).toBe("/processamentos-fiscais");
    expect(isNavItemActive("/processamentos-fiscais", FISCAL_NAV[1], ALL_NAV)).toBe(true);
    expect(isNavItemActive("/processamentos-fiscais", FISCAL_NAV[0], ALL_NAV)).toBe(false);
  });

  it("detalhe processamento: processamentos ativo (não importar)", () => {
    const path = "/processamentos-fiscais/2d8d4b04-38b4-4a1a-bcd3-77e1cec1bb87";
    expect(resolveActiveNavItem(path, ALL_NAV)?.to).toBe("/processamentos-fiscais");
    expect(isNavItemActive(path, FISCAL_NAV[0], ALL_NAV)).toBe(false);
    expect(isNavItemActive(path, FISCAL_NAV[1], ALL_NAV)).toBe(true);
  });

  it("config fiscal vs configurações gerais", () => {
    expect(resolveActiveNavItem("/configuracoes/fiscal", ALL_NAV)?.to).toBe("/configuracoes/fiscal");
    expect(isNavItemActive("/configuracoes/fiscal", CORE_NAV[3], ALL_NAV)).toBe(false);
    expect(isNavItemActive("/configuracoes", CORE_NAV[3], ALL_NAV)).toBe(true);
    expect(isNavItemActive("/configuracoes", FISCAL_NAV[3], ALL_NAV)).toBe(false);
  });

  it("detalhe guia: guias fiscais ativo", () => {
    const path = "/guias-fiscais/g-123";
    expect(resolveActiveNavItem(path, ALL_NAV)?.to).toBe("/guias-fiscais");
    expect(isNavItemActive(path, FISCAL_NAV[2], ALL_NAV)).toBe(true);
  });

  it("detalhe cliente / cobrança: item pai ativo", () => {
    expect(resolveActiveNavItem("/clientes/uuid-1", ALL_NAV)?.to).toBe("/clientes");
    expect(resolveActiveNavItem("/cobrancas/ch-1/editar", ALL_NAV)?.to).toBe("/cobrancas");
  });

  it("apenas um item ativo por rota fiscal", () => {
    const path = "/processamentos-fiscais/importar";
    const actives = ALL_NAV.filter((item) => isNavItemActive(path, item, ALL_NAV));
    expect(actives).toHaveLength(1);
    expect(actives[0]?.to).toBe("/processamentos-fiscais/importar");
  });
});
