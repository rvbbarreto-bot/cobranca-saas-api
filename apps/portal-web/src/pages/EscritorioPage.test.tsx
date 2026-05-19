import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { EscritorioPage } from "./EscritorioPage";

vi.mock("../lib/api", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../lib/api")>();
  return {
    ...mod,
    fetchPortalMe: vi.fn().mockResolvedValue({
      tenant: { id: "t1", slug: "escritorio-demo" },
      user: { email: "a@b.com", membership_role: "admin_escritorio" }
    }),
    fetchCobrancas: vi.fn().mockResolvedValue({ data: [], count: 0 }),
    fetchEscritorioAssinatura: vi.fn().mockResolvedValue({
      assinatura: {
        id: "sub-1",
        status: "trial",
        read_only: false,
        trial_ends_at: "2026-06-01T00:00:00.000Z",
        current_period_start: null,
        current_period_end: null,
        plano: {
          id: "p1",
          slug: "profissional",
          nome: "Profissional",
          max_clientes: 250,
          max_cobrancas_mes: 2000,
          preco_mensal: 299
        },
        uso: { year_month: "2026-05", clientes: 2, cobrancas_criadas_mes: 5 }
      }
    })
  };
});

function renderPage(): ReturnType<typeof render> {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <EscritorioPage />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

describe("EscritorioPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exibe plano e uso da assinatura", async () => {
    renderPage();
    expect(await screen.findByText(/Plano e assinatura/i)).toBeTruthy();
    expect(await screen.findByText("profissional")).toBeTruthy();
    expect(await screen.findByText(/2 \/ 250/)).toBeTruthy();
    expect(await screen.findByText(/5 \/ 2000/)).toBeTruthy();
  });
});
