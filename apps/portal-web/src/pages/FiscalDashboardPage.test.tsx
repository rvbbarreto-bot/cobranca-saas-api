import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { FiscalDashboardPage } from "./FiscalDashboardPage";

vi.mock("../hooks/useAuth", () => ({
  useAuth: () => ({ email: "admin@demo.local" })
}));

vi.mock("../lib/api", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../lib/api")>();
  return {
    ...mod,
    fetchFiscalDashboard: vi.fn()
  };
});

import { fetchFiscalDashboard } from "../lib/api";

const mockDashboard = vi.mocked(fetchFiscalDashboard);

function renderPage(): void {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <FiscalDashboardPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("FiscalDashboardPage (EXEQ-FISC-071)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDashboard.mockResolvedValue({
      competencia_atual: "2026-06",
      kpis: {
        processamentos_mes: 12,
        erros_abertos: 2,
        certificados_expirando: 1
      },
      ultimos_processamentos: [
        {
          id: "p1",
          portal_cliente_id: "c1",
          fiscal_ingest_id: "ing1",
          competencia: "2026-06",
          tipo: "PGDASD_APURACAO",
          status: "CONCLUIDO",
          valor_apurado: "100",
          protocolo_serpro: "MOCK",
          recibo_disponivel: true,
          guia_fiscal_id: "g1",
          erro_codigo: null,
          created_at: "2026-06-01T00:00:00Z",
          updated_at: "2026-06-01T00:00:00Z"
        }
      ],
      certificados_expirando: [
        {
          id: "cert1",
          portal_cliente_id: "c1",
          label: "Empresa Demo",
          valid_until: "2026-06-20",
          status: "expiring",
          days_left: 14
        }
      ]
    });
  });

  it("exibe KPIs e CTA de upload CSV", async () => {
    renderPage();
    expect(await screen.findByText("12")).toBeTruthy();
    expect(screen.getByText("Erros abertos")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Enviar arquivo CSV/i })).toHaveAttribute(
      "href",
      "/processamentos-fiscais/importar"
    );
  });

  it("lista últimos processamentos", async () => {
    renderPage();
    expect(await screen.findByRole("link", { name: /Junho\/2026 — Concluído/i })).toHaveAttribute(
      "href",
      "/processamentos-fiscais/p1"
    );
    expect(screen.getByText(/Ver todos os processamentos/i)).toBeTruthy();
  });
});
