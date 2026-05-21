import { validateJwtSecretForProduction } from "../platform/config/jwt-secret-policy";
import { getWebhookInboxSecret, isMockAuthRoutesEnabled, isProductionNodeEnv } from "../platform/config/runtime-flags";

/**
 * Avisos no boot quando configuracao de producao parece incompleta.
 */
export function logProductionWarnings(): void {
  if (!isProductionNodeEnv()) {
    return;
  }

  if (isMockAuthRoutesEnabled()) {
    // eslint-disable-next-line no-console
    console.warn(
      "[boot] AVISO: ENABLE_MOCK_AUTH permite rotas mock em NODE_ENV=production. Recomendado ENABLE_MOCK_AUTH=false."
    );
  }

  const jwtCheck = validateJwtSecretForProduction(process.env.JWT_SECRET);
  if (!jwtCheck.ok) {
    // eslint-disable-next-line no-console
    console.warn(`[boot] AVISO: ${jwtCheck.reason}`);
  }

  if (!getWebhookInboxSecret()) {
    // eslint-disable-next-line no-console
    console.warn(
      "[boot] AVISO: WEBHOOK_INBOX_SECRET ausente — POST /v1/inbox/webhooks retornara 503 ate configurar o segredo."
    );
  }
}
