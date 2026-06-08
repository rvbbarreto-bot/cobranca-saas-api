import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { ImportPgdasdPage } from "./ImportPgdasdPage";

vi.mock("../lib/fiscal-feature", () => ({
  isFiscalGuiasNavEnabled: () => true
}));

vi.mock("../lib/api", () => ({
  postFiscalIngestCsv: vi.fn(),
  postProcessamentosFromIngest: vi.fn(),
  ApiError: class ApiError extends Error {}
}));

function renderPage(): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <ImportPgdasdPage />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

describe("ImportPgdasdPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza zona de upload e colunas obrigatórias", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: /Importar PGDASD/i })).toBeInTheDocument();
    expect(screen.getByTestId("csv-upload-zone")).toBeInTheDocument();
    expect(screen.getByText(/cnpj/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Enviar e validar/i })).toBeDisabled();
  });
});
