import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ClienteDetalhePage } from "./ClienteDetalhePage";
import type { ClienteRow } from "../lib/api";

const CLIENTE_ID = "550e8400-e29b-41d4-a716-446655440099";

const clienteMock: ClienteRow = {
  id: CLIENTE_ID,
  tenant_id: "tenant-1",
  documento: "39053344705",
  nome: "Maria Teste",
  email: "maria@test.com",
  telefone: "11987654321",
  whatsapp_opt_in: true,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z"
};

vi.mock("../lib/api", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../lib/api")>();
  return {
    ...mod,
    fetchClienteById: vi.fn(),
    fetchClienteCobrancas: vi.fn().mockResolvedValue({
      data: [],
      count: 0,
      billing_link_status: "ok"
    })
  };
});

import { fetchClienteById } from "../lib/api";

function renderDetalhe(initialCache?: (qc: QueryClient) => void): ReturnType<typeof render> {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  initialCache?.(qc);
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/clientes/${CLIENTE_ID}`]}>
        <Routes>
          <Route path="/clientes/:id" element={<ClienteDetalhePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("ClienteDetalhePage — regressao tela branca", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchClienteById).mockResolvedValue(clienteMock);
  });

  it("renderiza ficha do cliente via GET por id", async () => {
    renderDetalhe();
    expect(await screen.findByText("Maria Teste")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Cobranças associadas" })).toBeTruthy();
    expect(fetchClienteById).toHaveBeenCalledWith(CLIENTE_ID);
  });

  it("nao quebra com cache legado infinite em ['clientes'] (lista)", async () => {
    renderDetalhe((qc) => {
      qc.setQueryData(["clientes"], {
        pages: [
          {
            data: [clienteMock],
            count: 1,
            page_limit: 50,
            next_cursor: null
          }
        ],
        pageParams: [undefined]
      });
    });
    expect(await screen.findByText("Maria Teste")).toBeTruthy();
  });

  it("exibe mensagem quando cliente nao existe", async () => {
    vi.mocked(fetchClienteById).mockResolvedValue(null);
    renderDetalhe();
    expect(await screen.findByText(/não encontrado/i)).toBeTruthy();
  });
});
