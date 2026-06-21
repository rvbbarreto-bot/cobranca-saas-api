import { describe, expect, it } from "vitest";
import { isUsableAsaasPlatformApiKey } from "../../src/modules/saas-billing/infrastructure/asaas-platform/platform-asaas-api-key";
import { getPlatformAsaasConfig, isPlatformBillingConfigured } from "../../src/modules/saas-billing/infrastructure/asaas-platform/platform-asaas-config";

describe("platform-asaas-api-key", () => {
  it("rejeita placeholders do .env.example", () => {
    expect(isUsableAsaasPlatformApiKey("TROCAR_sua_asaas_api_key")).toBe(false);
    expect(isUsableAsaasPlatformApiKey("")).toBe(false);
    expect(isUsableAsaasPlatformApiKey("curta")).toBe(false);
  });

  it("aceita chave sandbox realista", () => {
    expect(isUsableAsaasPlatformApiKey("$aact_hmlg_0123456789abcdef0123456789abcdef")).toBe(true);
  });
});

describe("getPlatformAsaasConfig", () => {
  it("ignora ASAAS_API_KEY placeholder", () => {
    const prevPlatform = process.env.ASAAS_PLATFORM_API_KEY;
    const prevApi = process.env.ASAAS_API_KEY;
    process.env.ASAAS_PLATFORM_API_KEY = "";
    process.env.ASAAS_API_KEY = "TROCAR_sua_asaas_api_key";
    try {
      expect(getPlatformAsaasConfig()).toBeNull();
      expect(isPlatformBillingConfigured()).toBe(false);
    } finally {
      process.env.ASAAS_PLATFORM_API_KEY = prevPlatform;
      process.env.ASAAS_API_KEY = prevApi;
    }
  });
});
