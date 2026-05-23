import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ToastProvider } from "../components/ToastProvider";
import { CobrancaFormPage } from "./CobrancaFormPage";
import type { ClienteRow } from "../lib/api";

const CLIENTE_ID = "550e8400-e29b-41d4-a716-446655440077";

vi.mock("../lib/api", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../lib/api")>();
  return {
    ...mod,
    fetchEscritorioConfig: vi.fn().mockResolvedValue({
      config: { gateway_provider: "asaas", tenant_id: "t1" }
    }),
    fetchClienteById: vi.fn(),
    postPortalCobranca: vi.fn()
  };
});

import { fetchClienteById } from "../lib/api";

function renderCobrar(): ReturnType<typeof render> {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <MemoryRouter initialEntries={[`/cobrancas/nova?clienteId=${CLIENTE_ID}`]}>
          <Routes>
            <Route path="/cobrancas/nova" element={<CobrancaFormPage />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}

describe("CobrancaFormPage — link Cobrar da lista", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchClienteById).mockResolvedValue({
      id: CLIENTE_ID,
      tenant_id: "t1",
      documento: "39053344705",
      nome: "Cliente Cobrar",
      email: "a@b.co",
      whatsapp_opt_in: false,
      created_at: "",
      updated_at: ""
    } satisfies ClienteRow);
  });

  it("renderiza formulario de nova cobranca com clienteId na URL", async () => {
    renderCobrar();
    expect(await screen.findByText(/Nova cobranca avulsa/i)).toBeTruthy();
    expect(screen.getByLabelText(/Referencia/i)).toBeTruthy();
    expect(fetchClienteById).toHaveBeenCalledWith(CLIENTE_ID);
  });
});
