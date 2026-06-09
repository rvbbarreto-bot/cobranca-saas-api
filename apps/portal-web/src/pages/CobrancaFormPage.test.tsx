import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { CobrancaFormPage } from "./CobrancaFormPage";
import { ToastProvider } from "../components/ToastProvider";

const postCobrancaMock = vi.fn();

vi.mock("../lib/api", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../lib/api")>();
  return {
    ...mod,
    fetchEscritorioConfig: vi.fn().mockResolvedValue({
      config: {
        tenant_id: "pub-1",
        cnpj_emissor: null,
        razao_social: "Demo LTDA",
        inscricao_municipal: null,
        regime_tributario: null,
        codigo_municipio: null,
        aliquota_iss: null,
        gateway_provider: "inter",
        gateway_api_key: "****1234",
        gateway_credentials_configured: true,
        whatsapp_provider: null,
        whatsapp_token: null
      }
    }),
    fetchClienteById: vi.fn().mockResolvedValue({
      id: "cliente-sem-endereco",
      nome: "Cliente QA",
      documento: "52998224725",
      email: "qa@test.local",
      endereco: null
    }),
    postPortalCobranca: (...args: unknown[]) => postCobrancaMock(...args)
  };
});

vi.mock("../components/ClienteAutocomplete", () => ({
  ClienteAutocomplete: ({
    value,
    onChange,
    error
  }: {
    value: string;
    onChange: (id: string) => void;
    error?: string;
  }) => (
    <div>
      <label htmlFor="mock-cliente">Cliente</label>
      <input
        id="mock-cliente"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={error ? "mock-cliente-err" : undefined}
      />
      {error ? (
        <span id="mock-cliente-err" className="err">
          {error}
        </span>
      ) : null}
    </div>
  )
}));

function renderPage(initialPath = "/cobrancas/nova?clienteId=cliente-sem-endereco"): void {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <MemoryRouter initialEntries={[initialPath]}>
          <Routes>
            <Route path="/cobrancas/nova" element={<CobrancaFormPage />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </QueryClientProvider>
  );
}

describe("CobrancaFormPage — bloqueio endereco O.2.2", () => {
  beforeEach(() => {
    postCobrancaMock.mockReset();
  });

  it("exibe aviso e desabilita criar quando Inter e cliente sem endereco", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByRole("button", { name: /Criar cobranca/i })).toBeDisabled());
    expect(screen.getByRole("status")).toHaveTextContent(/Banco Inter exige endereco completo/i);
    expect(screen.getByRole("link", { name: /Completar endereco do cliente/i })).toBeTruthy();
  });

  it("nao chama POST ao tentar submit com endereco incompleto", async () => {
    renderPage();
    const user = userEvent.setup();
    await waitFor(() => expect(screen.getByRole("button", { name: /Criar cobranca/i })).toBeDisabled());
    await user.click(screen.getByRole("button", { name: /Criar cobranca/i }));
    expect(postCobrancaMock).not.toHaveBeenCalled();
  });
});
