/**
 * Flags centrais para comportamento em producao vs desenvolvimento.
 * Documentacao: docs/API_CONTRATO_E_SMOKE.md, docs/PRODUCAO_ENDURECIMENTO_PASSO_A_PASSO.md
 */

export function isProductionNodeEnv(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Rotas mock de auth (`/v1/auth/token/mock`, `/v1/portal/auth/token/mock`, `/v1/tenants/provision/mock`).
 * - Producao (NODE_ENV=production): desligadas por padrao.
 * - Desenvolvimento: ligadas por padrao.
 * - Override explicito: ENABLE_MOCK_AUTH=true|false
 */
export function isMockAuthRoutesEnabled(): boolean {
  const raw = process.env.ENABLE_MOCK_AUTH?.trim().toLowerCase();
  if (raw === "false" || raw === "0") {
    return false;
  }
  if (raw === "true" || raw === "1") {
    return true;
  }
  return !isProductionNodeEnv();
}

/** Em producao o inbox exige segredo configurado (nao aceita receber webhooks sem chave). */
export function isWebhookInboxSecretRequired(): boolean {
  return isProductionNodeEnv();
}

export function getWebhookInboxSecret(): string | undefined {
  const s = process.env.WEBHOOK_INBOX_SECRET?.trim();
  return s || undefined;
}

export function getWebhookNfseSecret(): string | undefined {
  const s = process.env.WEBHOOK_NFSE_SECRET?.trim();
  return s || undefined;
}

export function isWebhookNfseSecretRequired(): boolean {
  return isProductionNodeEnv();
}

export function shouldEmitHttpAccessJsonLog(): boolean {
  if (process.env.ENABLE_HTTP_ACCESS_LOG === "false" || process.env.ENABLE_HTTP_ACCESS_LOG === "0") {
    return false;
  }
  if (process.env.ENABLE_HTTP_ACCESS_LOG === "true" || process.env.ENABLE_HTTP_ACCESS_LOG === "1") {
    return true;
  }
  return process.env.NODE_ENV !== "test";
}
