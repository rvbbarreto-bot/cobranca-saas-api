import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "./AppShell";

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ logout: vi.fn(), email: "admin@teste.local" })
}));

vi.mock("../hooks/useTheme", () => ({
  useTheme: () => ({ theme: "light", toggleTheme: vi.fn() })
}));

vi.mock("../lib/fiscal-feature", () => ({
  isFiscalGuiasNavEnabled: () => true
}));

vi.mock("../lib/api", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../lib/api")>();
  return {
    ...mod,
    fetchPortalMe: vi.fn()
  };
});

import { fetchPortalMe } from "../lib/api";

const mockMe = vi.mocked(fetchPortalMe);

function renderShell(initialPath: string): void {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/" element={<AppShell />}>
            <Route path="processamentos-fiscais/importar" element={<div>Página importar</div>} />
            <Route path="processamentos-fiscais/:id" element={<div>Página detalhe</div>} />
            <Route path="processamentos-fiscais" element={<div>Página lista</div>} />
            <Route path="configuracoes/fiscal" element={<div>Config fiscal</div>} />
            <Route path="configuracoes" element={<div>Config geral</div>} />
            <Route path="guias-fiscais/:id" element={<div>Guia detalhe</div>} />
            <Route path="guias-fiscais" element={<div>Guias lista</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

function activeNavLabels(): string[] {
  const nav = screen.getByRole("navigation");
  return within(nav)
    .getAllByRole("link")
    .filter((a) => a.className.includes("sidebar__link--active"))
    .map((a) => a.textContent?.trim() ?? "");
}

async function waitForNavReady(): Promise<void> {
  await screen.findByRole("link", { name: "Importar PGDASD" });
}

describe("AppShell — highlight único no menu lateral", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMe.mockResolvedValue({
      tenant: { id: "1", slug: "escritorio-demo" },
      user: {
        id: "u1",
        email: "admin@teste.local",
        full_name: "Admin",
        membership_role: "admin_escritorio",
        jwt_roles: ["admin_escritorio"]
      },
      modules: {
        cobranca: true,
        clientes: true,
        notas_fiscais: true,
        fiscal_guias: true,
        relatorios: true
      }
    });
  });

  it("Importar PGDASD: só um item fiscal ativo", async () => {
    renderShell("/processamentos-fiscais/importar");
    expect(await screen.findByText("Página importar")).toBeInTheDocument();
    await waitForNavReady();
    expect(activeNavLabels()).toEqual(["Importar PGDASD"]);
  });

  it("Processamentos PGDASD lista: só lista ativa", async () => {
    renderShell("/processamentos-fiscais");
    expect(await screen.findByText("Página lista")).toBeInTheDocument();
    await waitForNavReady();
    expect(activeNavLabels()).toEqual(["Processamentos PGDASD"]);
  });

  it("Detalhe processamento: lista ativa (não importar)", async () => {
    renderShell("/processamentos-fiscais/proc-uuid");
    expect(await screen.findByText("Página detalhe")).toBeInTheDocument();
    await waitForNavReady();
    expect(activeNavLabels()).toEqual(["Processamentos PGDASD"]);
  });

  it("Config fiscal vs configurações gerais", async () => {
    renderShell("/configuracoes/fiscal");
    expect(await screen.findByText("Config fiscal")).toBeInTheDocument();
    await screen.findByRole("link", { name: "Config. fiscal" });
    expect(activeNavLabels()).toContain("Config. fiscal");
    expect(activeNavLabels()).not.toContain("Configurações");
  });

  it("Configurações gerais: não marca config fiscal", async () => {
    renderShell("/configuracoes");
    expect(await screen.findByText("Config geral")).toBeInTheDocument();
    await screen.findByRole("link", { name: "Config. fiscal" });
    expect(activeNavLabels()).toContain("Configurações");
    expect(activeNavLabels()).not.toContain("Config. fiscal");
  });
});
