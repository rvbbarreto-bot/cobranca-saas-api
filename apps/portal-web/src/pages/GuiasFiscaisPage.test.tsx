import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { GuiasFiscaisPage } from "./GuiasFiscaisPage";
import { fetchGuiasFiscais } from "../lib/api";

vi.mock("../lib/fiscal-feature", () => ({
  isFiscalGuiasNavEnabled: () => true
}));

vi.mock("../lib/api", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../lib/api")>();
  return {
    ...mod,
    fetchGuiasFiscais: vi.fn()
  };
});

const mockFetch = vi.mocked(fetchGuiasFiscais);

const guiaDas = {
  id: "a1",
  portal_cliente_id: "c1",
  tipo_guia: "DAS" as const,
  competencia: "2026-05",
  data_vencimento: "2026-05-20",
  valor_principal: 100,
  valor_multa: 0,
  valor_juros: 0,
  valor_total: 100,
  linha_digitavel: null,
  pix_copia_cola: null,
  status: "DISPONIVEL",
  compliance_status: "aprovado",
  compliance_motivo: null,
  pdf_url: null,
  versao_atual: 1,
  created_at: "2026-05-01T00:00:00.000Z",
  updated_at: "2026-05-01T00:00:00.000Z"
};

const guiaDarf = { ...guiaDas, id: "a2", tipo_guia: "DARF" as const, competencia: "2026-06" };

function renderPage(): void {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <GuiasFiscaisPage />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

describe("GuiasFiscaisPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      guias: [guiaDas, guiaDarf],
      count: 2,
      next_cursor: null
    });
  });

  it("renderiza lista com badges DAS e DARF", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getAllByText("DAS").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("DARF").length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByText("Disponível").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Aprovado").length).toBeGreaterThanOrEqual(1);
  });

  it("filtra por tipo DARF na API", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByLabelText(/Filtrar por tipo de guia/i));

    await user.selectOptions(screen.getByLabelText(/Filtrar por tipo de guia/i), "DARF");

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.objectContaining({ tipo_guia: "DARF", limit: 50 })
      );
    });
  });

  it("filtra por competencia na API", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByLabelText(/Filtrar por competência/i));

    await user.type(screen.getByLabelText(/Filtrar por competência/i), "2026-06");

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.objectContaining({ competencia: "2026-06" })
      );
    });
  });
});
