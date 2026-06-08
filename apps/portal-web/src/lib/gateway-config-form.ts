import type { EscritorioConfig } from "./api";

/** Valor exibido em campos secretos no modo leitura (PO). */
export const MASKED_SECRET_DISPLAY = "***";

export function isGatewayIntegrationConfigured(config: EscritorioConfig | null | undefined): boolean {
  return Boolean(config?.gateway_provider?.trim() && config.gateway_credentials_configured);
}

/** Inicia em modo leitura quando gateway + credenciais já estão gravados. */
export function shouldStartGatewayViewMode(config: EscritorioConfig | null | undefined): boolean {
  return isGatewayIntegrationConfigured(config);
}

export function maskedSecretDisplay(masked: string | null | undefined): string {
  if (masked?.trim()) {
    return masked;
  }
  return MASKED_SECRET_DISPLAY;
}

export function credentialFieldDisplayValue(configured: boolean, secret: boolean): string {
  if (!configured) {
    return "";
  }
  return secret ? MASKED_SECRET_DISPLAY : MASKED_SECRET_DISPLAY;
}
