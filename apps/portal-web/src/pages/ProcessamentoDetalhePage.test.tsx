import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ProcessamentoDetalhePage } from "./ProcessamentoDetalhePage";
import { fetchProcessamentoFiscalDetail } from "../lib/api";

vi.mock("../lib/api", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../lib/api")>();
  return {
    ...mod,
    fetchProcessamentoFiscalDetail: vi.fn(),
    fetchProcessamentoReciboUrl: vi.fn(),
    fetchGuiaFiscalPdfUrl: vi.fn()
  };
});

const mockDetail = vi.mocked(fetchProcessamentoFiscalDetail);

function renderPage(id = "proc-1"): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/processamentos-fiscais/${id}`]}>
        <Routes>
          <Route path="/processamentos-fiscais/:processamentoId" element={<ProcessamentoDetalhePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("ProcessamentoDetalhePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDetail.mockResolvedValue({
      processamento: {
        id: "proc-1",
        portal_cliente_id: "c1",
        fiscal_ingest_id: "ing1",
        competencia: "2026-05",
        tipo: "PGDASD",
        status: "TRANSMITINDO",
        valor_apurado: "1000.00",
        protocolo_serpro: null,
        recibo_disponivel: false,
        guia_fiscal_id: null,
        erro_codigo: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      eventos: [
        {
          id: "e1",
          evento: "transmissao_iniciada",
          payload: {},
          created_at: new Date().toISOString()
        }
      ]
    });
  });

  it("exibe stepper e mensagem amigável com polling", async () => {
    renderPage();
    expect(await screen.findByTestId("fiscal-transmission-stepper")).toBeInTheDocument();
    expect(screen.getByTestId("fiscal-live-message")).toHaveTextContent(/Receita/i);
    expect(screen.getByText(/Início do envio à Receita/i)).toBeInTheDocument();
  });

  it("EXEQ-FISC-078: link processamento → guia DAS quando concluído", async () => {
    mockDetail.mockResolvedValue({
      processamento: {
        id: "proc-1",
        portal_cliente_id: "c1",
        fiscal_ingest_id: "ing1",
        competencia: "2026-05",
        tipo: "PGDASD",
        status: "CONCLUIDO",
        valor_apurado: "1000.00",
        protocolo_serpro: "123",
        recibo_disponivel: true,
        guia_fiscal_id: "guia-das-1",
        erro_codigo: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      eventos: []
    });

    renderPage();
    const verGuia = await screen.findByTestId("processamento-ver-guia");
    expect(verGuia).toHaveAttribute("href", "/guias-fiscais/guia-das-1");
    expect(screen.getByTestId("guia-pdf-download")).toHaveTextContent(/Baixar DAS/i);
    expect(screen.getByTestId("processamento-documentos")).toBeInTheDocument();
  });
});
