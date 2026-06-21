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

/** Pacote completo mTLS obrigatorio na edicao (ADR GATEWAY-MTLS-FULL-BUNDLE). */
export const MTLS_FULL_BUNDLE_ON_EDIT = true;

export function requiresMtlsPemUploadOnEdit(
  usesMtlsPem: boolean,
  isEditing: boolean,
  credentialsConfigured: boolean
): boolean {
  if (!usesMtlsPem || !isEditing) {
    return false;
  }
  if (!credentialsConfigured) {
    return true;
  }
  return MTLS_FULL_BUNDLE_ON_EDIT;
}

export function validateInterClientIdMatchesCertOu(clientId: string, integrationIdOu: string | null): void {
  const normalizedId = clientId.trim().toLowerCase();
  const normalizedOu = integrationIdOu?.trim().toLowerCase();
  if (!normalizedOu || !normalizedId) {
    return;
  }
  if (normalizedId !== normalizedOu) {
    throw new Error(
      `Client ID (${clientId.trim()}) difere do certificado (integracao ${integrationIdOu}). ` +
        "Use credenciais da mesma aplicacao no Portal Developers Inter."
    );
  }
}

export function validateMtlsFullBundleBeforeSave(input: {
  credentialsConfigured: boolean;
  usesMtlsPem: boolean;
  pemReady: boolean;
  clientId: string;
  clientSecret: string;
  integrationIdOu?: string | null;
  gatewayProvider?: string;
}): void {
  if (!input.usesMtlsPem || !input.credentialsConfigured || !MTLS_FULL_BUNDLE_ON_EDIT) {
    return;
  }
  if (!input.pemReady) {
    throw new Error(
      "Envie novamente certificado e chave privada da integracao. Alteracoes parciais nao sao permitidas."
    );
  }
  if (!input.clientId.trim() || !input.clientSecret.trim()) {
    throw new Error(
      "Informe Client ID e Client Secret da mesma integracao do certificado enviado."
    );
  }
  if (input.gatewayProvider === "inter") {
    validateInterClientIdMatchesCertOu(input.clientId, input.integrationIdOu ?? null);
  }
}
export function credentialFieldDisplayValue(configured: boolean, secret: boolean): string {
  if (!configured) {
    return "";
  }
  return secret ? MASKED_SECRET_DISPLAY : MASKED_SECRET_DISPLAY;
}
