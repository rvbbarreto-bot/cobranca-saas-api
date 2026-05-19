export type PlatformAsaasConfig = {
  apiKey: string;
  baseUrl?: string;
  billingType: "BOLETO" | "PIX" | "CREDIT_CARD";
};

export function getPlatformAsaasConfig(): PlatformAsaasConfig | null {
  const apiKey =
    process.env.ASAAS_PLATFORM_API_KEY?.trim() || process.env.ASAAS_API_KEY?.trim();
  if (!apiKey) {
    return null;
  }

  const billingRaw = (process.env.ASAAS_PLATFORM_BILLING_TYPE ?? "BOLETO").trim().toUpperCase();
  const billingType =
    billingRaw === "PIX" || billingRaw === "CREDIT_CARD" ? billingRaw : "BOLETO";

  return {
    apiKey,
    baseUrl:
      process.env.ASAAS_PLATFORM_API_URL?.trim() ||
      process.env.ASAAS_API_URL?.trim() ||
      undefined,
    billingType
  };
}
