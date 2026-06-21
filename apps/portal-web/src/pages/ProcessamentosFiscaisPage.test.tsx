import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { ProcessamentosFiscaisPage } from "./ProcessamentosFiscaisPage";

vi.mock("../lib/api", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../lib/api")>();
  return {
    ...mod,
    fetchProcessamentosFiscais: vi.fn(),
    fetchClientes: vi.fn()
  };
});

import { fetchClientes, fetchProcessamentosFiscais } from "../lib/api";

const mockProc = vi.mocked(fetchProcessamentosFiscais);
const mockClientes = vi.mocked(fetchClientes);

const rows = [
  {
    id: "p-ok",
    portal_cliente_id: "c1",
    fiscal_ingest_id: "ing1",
    competencia: "2026-05",
    tipo: "PGDASD_APURACAO",
    status: "CONCLUIDO",
    valor_apurado: "1000",
    protocolo_serpro: "MOCK-1",
    recibo_disponivel: true,
    guia_fiscal_id: "g1",
    erro_codigo: null,
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z"
  },
  {
    id: "p-erro",
    portal_cliente_id: "c1",
    fiscal_ingest_id: "ing2",
    competencia: "2026-04",
    tipo: "PGDASD_APURACAO",
    status: "ERRO",
    valor_apurado: "500",
    protocolo_serpro: null,
    recibo_disponivel: false,
    guia_fiscal_id: null,
    erro_codigo: "PROCURACAO_INVALIDA",
    created_at: "2026-06-02T00:00:00Z",
    updated_at: "2026-06-02T00:00:00Z"
  }
];

function renderPage(): void {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <ProcessamentosFiscaisPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("ProcessamentosFiscaisPage (EXEQ-FISC-074)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProc.mockResolvedValue({ processamentos: rows });
    mockClientes.mockResolvedValue({
      data: [
        {
          id: "c1",
          tenant_id: "1",
          documento: "00000000000191",
          nome: "Empresa Demo",
          email: null,
          whatsapp_opt_in: false,
          created_at: "",
          updated_at: ""
        }
      ],
      count: 1
    });
  });

  it("renderiza filtros e tabela histórico", async () => {
    renderPage();
    expect(await screen.findByTestId("proc-historico-table")).toBeInTheDocument();
    expect(screen.getByTestId("proc-filters")).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(3);
  });

  it("filtra somente com erro", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByTestId("proc-historico-table");
    await user.click(screen.getByTestId("proc-filter-somente-erro"));
    const bodyRows = within(screen.getByTestId("proc-historico-table")).getAllByRole("row").slice(1);
    expect(bodyRows).toHaveLength(1);
    expect(bodyRows[0]?.textContent).toContain("2026-04");
  });

  it("initialView=erros abre central de erros direto (FISC-070 /fiscal/erros)", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <ProcessamentosFiscaisPage initialView="erros" />
        </MemoryRouter>
      </QueryClientProvider>
    );
    expect(await screen.findByTestId("fiscal-erro-central")).toBeInTheDocument();
    expect(screen.getByTestId("proc-tab-erros")).toHaveClass("tab--active");
  });

  it("central de erros agrupa por código traduzido", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByTestId("proc-historico-table");
    await user.click(screen.getByTestId("proc-tab-erros"));
    expect(await screen.findByTestId("fiscal-erro-central")).toBeInTheDocument();
    expect(screen.getByText(/Procuração inválida/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Abrir Procurações/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Empresa Demo.*2026-04/i })).toHaveAttribute(
      "href",
      "/processamentos-fiscais/p-erro"
    );
  });
});
