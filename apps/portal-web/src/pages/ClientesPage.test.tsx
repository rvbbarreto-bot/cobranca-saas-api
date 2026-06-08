import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { ClientesPage } from "./ClientesPage";

vi.mock("../lib/fiscal-feature", () => ({
  isFiscalGuiasNavEnabled: vi.fn(() => true)
}));

const mockFetchClientes = vi.fn();
const mockFetchCobrancas = vi.fn();
const mockFetchConfig = vi.fn();
const mockFetchProcessamentos = vi.fn();
const mockFetchCert = vi.fn();
const mockFetchProc = vi.fn();
const mockFetchExpiring = vi.fn();

vi.mock("../lib/api", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../lib/api")>();
  return {
    ...mod,
    fetchClientes: (...args: unknown[]) => mockFetchClientes(...args),
    fetchCobrancas: (...args: unknown[]) => mockFetchCobrancas(...args),
    fetchEscritorioConfig: (...args: unknown[]) => mockFetchConfig(...args),
    fetchProcessamentosFiscais: (...args: unknown[]) => mockFetchProcessamentos(...args),
    fetchCertificadoDigital: (...args: unknown[]) => mockFetchCert(...args),
    fetchProcuracao: (...args: unknown[]) => mockFetchProc(...args),
    fetchExpiringCertificates: (...args: unknown[]) => mockFetchExpiring(...args)
  };
});

function renderPage(): void {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <ClientesPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("ClientesPage (EXEQ-FISC-079)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchClientes.mockResolvedValue({
      data: [
        {
          id: "c1",
          tenant_id: "t1",
          documento: "11222333000181",
          nome: "Empresa Alpha",
          email: null,
          whatsapp_opt_in: false,
          created_at: "",
          updated_at: ""
        }
      ],
      count: 1,
      next_cursor: null
    });
    mockFetchCobrancas.mockResolvedValue({ data: [] });
    mockFetchConfig.mockResolvedValue({ config: { gateway_provider: "asaas" } });
    mockFetchProcessamentos.mockResolvedValue({
      processamentos: [
        {
          id: "proc-1",
          portal_cliente_id: "c1",
          fiscal_ingest_id: "ing1",
          competencia: "2026-05",
          tipo: "PGDASD",
          status: "CONCLUIDO",
          valor_apurado: "100",
          protocolo_serpro: "123",
          recibo_disponivel: true,
          guia_fiscal_id: "g1",
          erro_codigo: null,
          created_at: "",
          updated_at: "2026-06-01T00:00:00.000Z"
        }
      ]
    });
    mockFetchCert.mockResolvedValue({
      certificado: {
        id: "cert1",
        portal_cliente_id: "c1",
        label: "A1",
        valid_from: "2026-01-01",
        valid_until: "2027-01-01",
        ativo: true,
        created_at: "",
        updated_at: ""
      }
    });
    mockFetchProc.mockResolvedValue({
      procuracao: {
        id: "p1",
        portal_cliente_id: "c1",
        tipo: "ecac",
        procurador_documento: "123",
        validade_inicio: "2026-01-01",
        validade_fim: "2027-01-01",
        ativa: true,
        metadata: { serpro_situacao: "valida" },
        created_at: "",
        updated_at: ""
      }
    });
    mockFetchExpiring.mockResolvedValue({ certificados: [] });
  });

  it("exibe coluna fiscal e indicadores por cliente", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Empresa Alpha")).toBeInTheDocument();
    });
    expect(screen.getByRole("columnheader", { name: /Fiscal/i })).toBeInTheDocument();
    expect(await screen.findByTestId("cliente-fiscal-c1")).toBeInTheDocument();
    expect(screen.getByText("Proc. OK")).toBeInTheDocument();
  });

  it("exibe atalho Nova apuração por cliente", async () => {
    renderPage();
    const link = await screen.findByTestId("nova-apuracao-c1");
    expect(link).toHaveAttribute("href", "/processamentos-fiscais/importar?clienteId=c1");
  });
});
