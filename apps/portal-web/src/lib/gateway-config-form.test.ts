import { describe, expect, it } from "vitest";
import {
  credentialFieldDisplayValue,
  isGatewayIntegrationConfigured,
  maskedSecretDisplay,
  shouldStartGatewayViewMode
} from "./gateway-config-form";
import type { EscritorioConfig } from "./api";

const configured: EscritorioConfig = {
  tenant_id: "t1",
  cnpj_emissor: null,
  razao_social: "Demo",
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

describe("gateway-config-form", () => {
  it("detecta integracao configurada", () => {
    expect(isGatewayIntegrationConfigured(configured)).toBe(true);
    expect(shouldStartGatewayViewMode(configured)).toBe(true);
  });

  it("modo edicao quando provider sem credenciais", () => {
    expect(
      shouldStartGatewayViewMode({
        ...configured,
        gateway_credentials_configured: false
      })
    ).toBe(false);
  });

  it("mascara segredos para exibicao", () => {
    expect(maskedSecretDisplay("****1234")).toBe("****1234");
    expect(maskedSecretDisplay(null)).toBe("***");
    expect(credentialFieldDisplayValue(true, true)).toBe("***");
  });
});
