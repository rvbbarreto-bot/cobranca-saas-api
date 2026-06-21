import { afterEach, describe, expect, it } from "vitest";
import {
  assertMtlsFullBundleOnUpdate,
  isMtlsFullBundlePolicyEnabled,
  shouldReplaceMtlsCredentialsOnUpload
} from "../../src/platform/payment-gateway/mtls-full-bundle-policy";
import { GatewayCredentialsValidationError } from "../../src/modules/payment-gateway/domain/payment-gateway-error";

describe("mtls-full-bundle-policy", () => {
  const prev = process.env.GATEWAY_MTLS_REQUIRE_FULL_BUNDLE;

  afterEach(() => {
    if (prev === undefined) {
      delete process.env.GATEWAY_MTLS_REQUIRE_FULL_BUNDLE;
    } else {
      process.env.GATEWAY_MTLS_REQUIRE_FULL_BUNDLE = prev;
    }
  });

  it("habilitado por default", () => {
    delete process.env.GATEWAY_MTLS_REQUIRE_FULL_BUNDLE;
    expect(isMtlsFullBundlePolicyEnabled()).toBe(true);
  });

  it("rejeita alteracao parcial sem novo upload quando ja configurado", () => {
    process.env.GATEWAY_MTLS_REQUIRE_FULL_BUNDLE = "true";
    expect(() =>
      assertMtlsFullBundleOnUpdate({
        provider: "inter",
        credentialsAlreadyConfigured: true,
        gatewayCredentials: { client_id: "85bac250-37b3-4717-9a58-157976ae3b1a" }
      })
    ).toThrow(GatewayCredentialsValidationError);
  });

  it("exige client_id e client_secret com upload na reconfiguracao", () => {
    process.env.GATEWAY_MTLS_REQUIRE_FULL_BUNDLE = "true";
    expect(() =>
      assertMtlsFullBundleOnUpdate({
        provider: "inter",
        credentialsAlreadyConfigured: true,
        certificateUploadId: "11111111-1111-4111-8111-111111111111",
        gatewayCredentials: { client_id: "85bac250-37b3-4717-9a58-157976ae3b1a" }
      })
    ).toThrow(/client_secret/);
  });

  it("aceita pacote completo com upload na reconfiguracao", () => {
    process.env.GATEWAY_MTLS_REQUIRE_FULL_BUNDLE = "true";
    expect(() =>
      assertMtlsFullBundleOnUpdate({
        provider: "inter",
        credentialsAlreadyConfigured: true,
        certificateUploadId: "11111111-1111-4111-8111-111111111111",
        gatewayCredentials: {
          client_id: "85bac250-37b3-4717-9a58-157976ae3b1a",
          client_secret: "segredo"
        }
      })
    ).not.toThrow();
  });

  it("primeira configuracao nao exige politica de edicao", () => {
    process.env.GATEWAY_MTLS_REQUIRE_FULL_BUNDLE = "true";
    expect(() =>
      assertMtlsFullBundleOnUpdate({
        provider: "inter",
        credentialsAlreadyConfigured: false,
        gatewayCredentials: { client_id: "x" }
      })
    ).not.toThrow();
  });

  it("shouldReplaceMtlsCredentialsOnUpload quando upload + ja configurado", () => {
    process.env.GATEWAY_MTLS_REQUIRE_FULL_BUNDLE = "true";
    expect(
      shouldReplaceMtlsCredentialsOnUpload({
        provider: "inter",
        credentialsAlreadyConfigured: true,
        certificateUploadId: "11111111-1111-4111-8111-111111111111"
      })
    ).toBe(true);
  });
});
