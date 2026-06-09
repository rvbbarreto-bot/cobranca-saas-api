import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ConfiguracoesPage } from "./ConfiguracoesPage";

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../../tests/fixtures");
const TEST_CERT = fs.readFileSync(path.join(fixturesDir, "test-mtls.crt"), "utf8");
const TEST_KEY = fs.readFileSync(path.join(fixturesDir, "test-mtls.key"), "utf8");

const patchConfigMock = vi.fn();
const patchGatewayMock = vi.fn();

vi.mock("../lib/api", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../lib/api")>();
  const interProvider = {
    id: "inter",
    label: "Banco Inter",
    enabled: true,
    authType: "mtls_oauth" as const,
    credentialFields: [
      { key: "client_id", label: "Client ID", secret: false, required: true },
      { key: "client_secret", label: "Client Secret", secret: true, required: true },
      { key: "certificate_pem", label: "Certificado PEM", secret: true, required: true },
      { key: "private_key_pem", label: "Chave privada PEM", secret: true, required: true }
    ],
    supportsBoleto: true,
    supportsPix: false
  };
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
    fetchGatewayProviders: vi.fn().mockResolvedValue({ data: [asaasProvider, interProvider] }),
    fetchGatewayProviderSchema: vi.fn().mockImplementation((provider: string) =>
      Promise.resolve({
        provider: provider === "inter" ? interProvider : asaasProvider
      })
    ),
    fetchGatewayChangeHistory: vi.fn().mockResolvedValue({ data: [] }),
    patchEscritorioConfig: (...args: unknown[]) => patchConfigMock(...args),
    patchGatewayProvider: (...args: unknown[]) => patchGatewayMock(...args),
    validateCertificateUpload: vi.fn(),
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
    const keyInput = screen.getByPlaceholderText(/Mín\. 10 caracteres/i);
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

  it("apos salvar inter mantem gateway e exibe modo leitura mascarado", async () => {
    const user = userEvent.setup();
    const certPem = TEST_CERT;
    const keyPem = TEST_KEY;
    const certFile = new File([certPem], "cert.crt", { type: "application/x-pem-file" });
    const keyFile = new File([keyPem], "key.key", { type: "application/x-pem-file" });
    const interConfig = {
      tenant_id: "pub-1",
      cnpj_emissor: null,
      razao_social: "Demo LTDA",
      inscricao_municipal: null,
      regime_tributario: null,
      codigo_municipio: null,
      aliquota_iss: null,
      gateway_provider: "inter",
      gateway_api_key: null,
      gateway_credentials_configured: true,
      whatsapp_provider: null,
      whatsapp_token: null
    };
    patchGatewayMock.mockResolvedValueOnce({ config: interConfig });
    const { fetchEscritorioConfig, validateCertificateUpload } = await import("../lib/api");
    vi.mocked(validateCertificateUpload).mockResolvedValue({
      certificate_id: "11111111-1111-4111-8111-111111111111",
      subject_cn: "demo",
      not_after: "2027-01-01T00:00:00Z",
      days_remaining: 365,
      warnings: [],
      info: ["Par certificado/chave validado com sucesso."]
    });
    vi.mocked(fetchEscritorioConfig)
      .mockResolvedValueOnce({
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
      })
      .mockResolvedValue({ config: interConfig });
    renderPage();
    await screen.findByDisplayValue("Demo LTDA");
    await user.selectOptions(screen.getByLabelText(/Gateway/i), "inter");
    await user.type(screen.getByLabelText(/Client ID/i), "meu-client-id");
    await user.type(screen.getByLabelText(/Client Secret/i), "segredo_super_secreto");
    const certInput = document.querySelector('input[accept*=".crt"]') as HTMLInputElement;
    const keyInput = document.querySelectorAll('input[accept*=".crt"]')[1] as HTMLInputElement;
    await user.upload(certInput, certFile);
    await user.upload(keyInput, keyFile);
    await waitFor(() => expect(validateCertificateUpload).toHaveBeenCalled());
    await user.click(screen.getByRole("button", { name: /Guardar configurações/i }));
    await waitFor(() => expect(patchGatewayMock).toHaveBeenCalled());
    const body = patchGatewayMock.mock.calls[0]?.[0] as {
      gateway_provider?: string;
      certificate_upload_id?: string;
    };
    expect(body.gateway_provider).toBe("inter");
    expect(body.certificate_upload_id).toBe("11111111-1111-4111-8111-111111111111");
    await waitFor(() => expect(screen.getByRole("button", { name: /^Editar$/i })).toBeTruthy());
    expect((screen.getByLabelText(/Gateway/i) as HTMLSelectElement).value).toBe("inter");
    expect(screen.getByLabelText(/Client Secret/i)).toHaveValue("***");
    expect((screen.getByLabelText(/Gateway/i) as HTMLSelectElement).disabled).toBe(true);
  });

  it("clicar Editar habilita campos sem chamar PATCH", async () => {
    const user = userEvent.setup();
    const { fetchEscritorioConfig } = await import("../lib/api");
    vi.mocked(fetchEscritorioConfig).mockResolvedValue({
      config: {
        tenant_id: "pub-1",
        cnpj_emissor: null,
        razao_social: "EXEQ TECNOLOGIA LTDA",
        inscricao_municipal: null,
        regime_tributario: null,
        codigo_municipio: null,
        aliquota_iss: null,
        gateway_provider: "inter",
        gateway_api_key: null,
        gateway_credentials_configured: true,
        whatsapp_provider: null,
        whatsapp_token: null
      }
    });
    renderPage();
    await screen.findByDisplayValue("EXEQ TECNOLOGIA LTDA");
    await user.click(screen.getByRole("button", { name: /^Editar$/i }));
    expect(patchGatewayMock).not.toHaveBeenCalled();
    expect(patchConfigMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Guardar configurações/i })).toBeTruthy();
    expect((screen.getByLabelText(/Gateway/i) as HTMLSelectElement).disabled).toBe(false);
    expect(screen.getByLabelText(/Client ID/i)).not.toHaveAttribute("readonly");
  });

  it("modo leitura com credenciais configuradas mostra Editar", async () => {
    const { fetchEscritorioConfig } = await import("../lib/api");
    vi.mocked(fetchEscritorioConfig).mockResolvedValueOnce({
      config: {
        tenant_id: "pub-1",
        cnpj_emissor: null,
        razao_social: "EXEQ TECNOLOGIA LTDA",
        inscricao_municipal: null,
        regime_tributario: null,
        codigo_municipio: null,
        aliquota_iss: null,
        gateway_provider: "inter",
        gateway_api_key: null,
        gateway_credentials_configured: true,
        whatsapp_provider: null,
        whatsapp_token: null
      }
    });
    renderPage();
    await screen.findByDisplayValue("EXEQ TECNOLOGIA LTDA");
    expect(screen.getByRole("button", { name: /^Editar$/i })).toBeTruthy();
    expect((screen.getByLabelText(/Gateway/i) as HTMLSelectElement).value).toBe("inter");
    expect(screen.queryByRole("button", { name: /Guardar configurações/i })).toBeNull();
  });
});
