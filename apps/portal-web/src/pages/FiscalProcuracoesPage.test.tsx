import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { FiscalProcuracoesPage } from "./FiscalProcuracoesPage";

vi.mock("../lib/fiscal-feature", () => ({
  isFiscalGuiasNavEnabled: () => true
}));

const mockFetchProc = vi.fn();

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
    fetchClientes: vi.fn().mockResolvedValue({
      data: [
        {
          id: "c1",
          tenant_id: "t1",
          documento: "11222333000181",
          nome: "Empresa Teste",
          email: null,
          whatsapp_opt_in: false,
          created_at: "",
          updated_at: ""
        }
      ],
      count: 1
    }),
    fetchProcuracao: (...args: unknown[]) => mockFetchProc(...args),
    postProcuracao: vi.fn(),
    postValidarProcuracaoSerpro: vi.fn().mockResolvedValue({
      situacao: "valida",
      mensagem: "OK mock",
      procuracao: {
        id: "p1",
        portal_cliente_id: "c1",
        tipo: "ecac",
        procurador_documento: "12345678901",
        validade_inicio: "2026-01-01",
        validade_fim: "2027-01-01",
        ativa: true,
        metadata: { serpro_situacao: "valida" },
        created_at: "",
        updated_at: ""
      }
    })
  };
});

function renderPage(initial = "/fiscal/procuracoes"): void {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initial]}>
        <Routes>
          <Route path="/fiscal/procuracoes" element={<FiscalProcuracoesPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("FiscalProcuracoesPage (EXEQ-FISC-076)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchProc.mockResolvedValue({ procuracao: null });
  });

  it("lista empresas e semáforo na tabela", async () => {
    mockFetchProc.mockResolvedValue({
      procuracao: {
        id: "p1",
        portal_cliente_id: "c1",
        tipo: "ecac",
        procurador_documento: "12345678901",
        validade_inicio: "2026-01-01",
        validade_fim: "2027-01-01",
        ativa: true,
        metadata: { serpro_situacao: "valida" },
        created_at: "",
        updated_at: ""
      }
    });
    renderPage();
    await waitFor(() => {
      expect(within(screen.getByTestId("fiscal-proc-list")).getByText("e-CAC")).toBeInTheDocument();
    });
    const table = within(screen.getByTestId("fiscal-proc-list"));
    expect(table.getByTestId("fiscal-serpro-semaphore")).toHaveClass("fiscal-semaphore--green");
    expect(table.getByText(/Válida/i)).toBeInTheDocument();
  });

  it("botão Validar no SERPRO no formulário", async () => {
    const user = userEvent.setup();
    mockFetchProc.mockResolvedValue({
      procuracao: {
        id: "p1",
        portal_cliente_id: "c1",
        tipo: "ecac",
        procurador_documento: "12345678901",
        validade_inicio: "2026-01-01",
        validade_fim: "2027-01-01",
        ativa: true,
        metadata: { serpro_situacao: "nao_validada" },
        created_at: "",
        updated_at: ""
      }
    });
    renderPage("/fiscal/procuracoes?cliente=c1");
    expect(await screen.findByTestId("fiscal-validar-serpro-btn")).toBeInTheDocument();
    await user.click(screen.getByTestId("fiscal-validar-serpro-btn"));
  });
});
