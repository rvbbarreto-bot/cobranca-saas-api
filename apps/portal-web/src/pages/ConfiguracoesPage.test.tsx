import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { ConfiguracoesPage } from "./ConfiguracoesPage";

const patchConfigMock = vi.fn();
const patchGatewayMock = vi.fn();

vi.mock("../lib/api", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../lib/api")>();
  const asaasProvider = {
    id: "asaas",
    label: "Asaas",
    enabled: true,
    authType: "api_key" as const,
    credentialFields: [{ key: "api_key", label: "API Key", secret: true, required: true }],
    supportsBoleto: true,
    supportsPix: true
  };
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
        gateway_credentials_configured: false,
        whatsapp_provider: null,
        whatsapp_token: null
      }
    }),
    fetchGatewayProviders: vi.fn().mockResolvedValue({ data: [asaasProvider] }),
    fetchGatewayProviderSchema: vi.fn().mockResolvedValue({ provider: asaasProvider }),
    fetchGatewayChangeHistory: vi.fn().mockResolvedValue({ data: [] }),
    patchEscritorioConfig: (...args: unknown[]) => patchConfigMock(...args),
    patchGatewayProvider: (...args: unknown[]) => patchGatewayMock(...args),
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
    patchConfigMock.mockResolvedValue({ config: {} });
    patchGatewayMock.mockResolvedValue({
      config: {
        tenant_id: "pub-1",
        gateway_provider: "asaas",
        gateway_api_key: "****9999"
      }
    });
  });

  it("renderiza abas de configuracao", async () => {
    renderPage();
    expect(await screen.findByText(/Configurações do escritório/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Gateway e integrações/i })).toBeTruthy();
  });

  it("submete PATCH gateway com nova api key", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByDisplayValue("Demo LTDA");
    const keyInput = screen.getByPlaceholderText(/Deixe em branco para manter/i);
    await user.clear(keyInput);
    await user.type(keyInput, "nova_chave_api_12345");
    await user.click(screen.getByRole("button", { name: /Guardar configurações/i }));
    await waitFor(() => expect(patchGatewayMock).toHaveBeenCalled());
    const body = patchGatewayMock.mock.calls[0]?.[0] as {
      gateway_provider?: string;
      gateway_api_key?: string;
    };
    expect(body.gateway_provider).toBe("asaas");
    expect(body.gateway_api_key).toBe("nova_chave_api_12345");
  });
});
