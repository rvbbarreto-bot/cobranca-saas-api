import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ClienteEditPage } from "./ClienteEditPage";
import type { ClienteRow } from "../lib/api";

const CLIENTE_ID = "550e8400-e29b-41d4-a716-446655440088";

const clienteMock: ClienteRow = {
  id: CLIENTE_ID,
  tenant_id: "tenant-1",
  documento: "11222333000181",
  nome: "Empresa Teste",
  email: "contato@test.com",
  telefone: null,
  whatsapp_opt_in: false,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z"
};

vi.mock("../lib/api", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../lib/api")>();
  return {
    ...mod,
    fetchClienteById: vi.fn(),
    patchPortalCliente: vi.fn()
  };
});

import { fetchClienteById } from "../lib/api";

function renderEditar(): ReturnType<typeof render> {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setQueryData(["clientes"], {
    pages: [{ data: [clienteMock], next_cursor: null }],
    pageParams: [undefined]
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/clientes/${CLIENTE_ID}/editar`]}>
        <Routes>
          <Route path="/clientes/:id/editar" element={<ClienteEditPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("ClienteEditPage — regressao tela branca", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchClienteById).mockResolvedValue(clienteMock);
  });

  it("renderiza formulario mesmo com cache infinite em clientes", async () => {
    renderEditar();
    expect(await screen.findByDisplayValue("Empresa Teste")).toBeTruthy();
    expect(screen.getByDisplayValue("contato@test.com")).toBeTruthy();
  });
});
