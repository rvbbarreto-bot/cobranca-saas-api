import { describe, expect, it } from "vitest";
import {
  credentialFieldDisplayValue,
  isGatewayIntegrationConfigured,
  maskedSecretDisplay,
  requiresMtlsPemUploadOnEdit,
  shouldStartGatewayViewMode,
  validateInterClientIdMatchesCertOu,
  validateMtlsFullBundleBeforeSave
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

  it("exige upload PEM na edicao mTLS com credenciais gravadas", () => {
    expect(requiresMtlsPemUploadOnEdit(true, true, true)).toBe(true);
    expect(requiresMtlsPemUploadOnEdit(true, true, false)).toBe(true);
    expect(requiresMtlsPemUploadOnEdit(true, false, true)).toBe(false);
  });

  it("validateMtlsFullBundleBeforeSave bloqueia edicao parcial", () => {
    expect(() =>
      validateMtlsFullBundleBeforeSave({
        credentialsConfigured: true,
        usesMtlsPem: true,
        pemReady: false,
        clientId: "id",
        clientSecret: "secret"
      })
    ).toThrow(/certificado e chave/i);
  });

  it("validateInterClientIdMatchesCertOu bloqueia mismatch Inter", () => {
    expect(() =>
      validateInterClientIdMatchesCertOu("72853ecb-ba07-4222-ad49-018f150b45f6", "9320d067-c258-44c4-935e-db73973fb78e")
    ).toThrow(/difere do certificado/i);
    expect(() =>
      validateInterClientIdMatchesCertOu(
        "9320d067-c258-44c4-935e-db73973fb78e",
        "9320d067-c258-44c4-935e-db73973fb78e"
      )
    ).not.toThrow();
  });
});
