import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { ConfiguracoesPage } from "./ConfiguracoesPage";

const patchConfigMock = vi.fn();

vi.mock("../lib/api", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../lib/api")>();
  return {
    ...mod,
    fetchPortalMe: vi.fn().mockResolvedValue({
      tenant: { id: "t1", slug: "escritorio-demo" },
      user: { email: "a@b.com", membership_role: "admin_escritorio" }
    }),
    fetchEscritorioConfig: vi.fn().mockResolvedValue({
      config: {
        tenant_id: "pub-1",
        cnpj_emissor: null,
        razao_social: "Demo LTDA",
        inscricao_municipal: null,
        regime_tributario: null,
        codigo_municipio: null,
        aliquota_iss: null,
        gateway_provider: "asaas",
        gateway_api_key: "****1234",
        whatsapp_provider: null,
        whatsapp_token: null
      }
    }),
    patchEscritorioConfig: (...args: unknown[]) => patchConfigMock(...args),
    fetchChargingRules: vi.fn().mockResolvedValue({ data: [] }),
    fetchNotificationTemplates: vi.fn().mockResolvedValue({ data: [] }),
    fetchCobrancas: vi.fn().mockResolvedValue({ data: [], count: 0 })
  };
});

function renderPage(): ReturnType<typeof render> {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <ConfiguracoesPage />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

describe("ConfiguracoesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    patchConfigMock.mockResolvedValue({
      config: {
        tenant_id: "pub-1",
        razao_social: "Demo LTDA",
        gateway_provider: "asaas",
        gateway_api_key: "****9999"
      }
    });
  });

  it("renderiza abas de configuracao", async () => {
    renderPage();
    expect(await screen.findByText(/Configurações do escritório/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Gateway e integrações/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Régua de cobrança/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Templates/i })).toBeTruthy();
  });

  it("submete PATCH de config com nova api key", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByDisplayValue("Demo LTDA");
    const keyInput = screen.getByPlaceholderText(/Deixe em branco para manter/i);
    await user.clear(keyInput);
    await user.type(keyInput, "nova_chave_api_12345");
    await user.click(screen.getByRole("button", { name: /Guardar configurações/i }));
    await waitFor(() => expect(patchConfigMock).toHaveBeenCalled());
    const body = patchConfigMock.mock.calls[0]?.[0] as { gateway_api_key?: string };
    expect(body.gateway_api_key).toBe("nova_chave_api_12345");
  });
});
