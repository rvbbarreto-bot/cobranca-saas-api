import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { FiscalConexaoReceitaPage } from "./FiscalConexaoReceitaPage";

vi.mock("../lib/fiscal-feature", () => ({
  isFiscalGuiasNavEnabled: () => true
}));

const mockFetch = vi.fn();
const mockPatch = vi.fn();

vi.mock("../lib/api", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../lib/api")>();
  return {
    ...mod,
    fetchPortalMe: vi.fn().mockResolvedValue({
      tenant: { id: "t1", slug: "escritorio-demo" },
      user: {
        id: "u1",
        email: "a@b.com",
        full_name: "Admin",
        membership_role: "admin_escritorio",
        jwt_roles: ["admin_escritorio"]
      },
      modules: { cobranca: true, clientes: true, notas_fiscais: true, fiscal_guias: true, relatorios: true }
    }),
    fetchSerproConfig: (...args: unknown[]) => mockFetch(...args),
    patchSerproConfig: (...args: unknown[]) => mockPatch(...args)
  };
});

function renderPage(): void {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/configuracoes/fiscal/conexao-receita"]}>
        <Routes>
          <Route path="/configuracoes/fiscal/conexao-receita" element={<FiscalConexaoReceitaPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("FiscalConexaoReceitaPage (EXEQ-FISC-077)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      serpro_config: {
        organization_id: "org-1",
        ambiente: "demo",
        contratante_cnpj: "",
        serpro_enabled: false,
        consumer_key_configured: false,
        consumer_secret_configured: false,
        updated_at: null
      }
    });
  });

  it("renderiza formulário ambiente demo/prod e CNPJ contratante", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Conexão Receita Federal/i })).toBeInTheDocument();
    });
    expect(await screen.findByLabelText(/CNPJ contratante SERPRO/i)).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Homologação/i })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Produção/i })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: /Navegação fiscal/i })).toBeInTheDocument();
  });

  it("submete PATCH com credenciais ao guardar", async () => {
    const user = userEvent.setup();
    mockPatch.mockResolvedValue({
      serpro_config: {
        organization_id: "org-1",
        ambiente: "demo",
        contratante_cnpj: "11.***.***/****-81",
        serpro_enabled: true,
        consumer_key_configured: true,
        consumer_secret_configured: true,
        updated_at: "2026-06-06T12:00:00.000Z"
      }
    });

    renderPage();
    await screen.findByLabelText(/CNPJ contratante SERPRO/i);

    await user.type(screen.getByLabelText(/CNPJ contratante SERPRO/i), "11222333000181");
    await user.type(screen.getByLabelText(/^Consumer key$/i), "consumer-key-test");
    await user.type(screen.getByLabelText(/^Consumer secret$/i), "consumer-secret-test");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: /Guardar conexão/i }));

    await waitFor(() => expect(mockPatch).toHaveBeenCalled());
    expect(mockPatch.mock.calls[0][0]).toMatchObject({
      ambiente: "demo",
      contratante_cnpj: "11222333000181",
      serpro_enabled: true,
      consumer_key: "consumer-key-test",
      consumer_secret: "consumer-secret-test"
    });
  });
});
