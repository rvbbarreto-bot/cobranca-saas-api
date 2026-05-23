import type https from "node:https";
import { GatewayAuthError } from "../../domain/payment-gateway-error";
import type { GatewayAdapterContext } from "../../domain/gateway-types";
import { getCachedOAuthToken, setCachedOAuthToken } from "../../../../platform/payment-gateway/oauth-token-cache";
import { mtlsFetch } from "../../../../platform/payment-gateway/mtls-fetch";
import type { CoraTokenResponse } from "./cora-types";

const CORA_STAGE_BASE = "https://matls-clients.api.stage.cora.com.br";
const CORA_PROD_BASE = "https://matls-clients.api.cora.com.br";

export function coraBaseUrl(sandbox: boolean): string {
  return sandbox ? CORA_STAGE_BASE : CORA_PROD_BASE;
}

export async function getCoraAccessToken(
  ctx: GatewayAdapterContext,
  agent: https.Agent
): Promise<string> {
  const cached = await getCachedOAuthToken("cora", ctx.tenantId);
  if (cached) return cached;

  const clientId = ctx.credentials.client_id?.trim();
  if (!clientId) {
    throw new GatewayAuthError("cora", "client_id obrigatorio.");
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId
  }).toString();

  const base = coraBaseUrl(ctx.sandbox);
  const res = await mtlsFetch(`${base}/token`, {
    method: "POST",
    agent,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  if (res.status < 200 || res.status >= 300) {
    throw new GatewayAuthError("cora", `Token HTTP ${res.status}`, {
      httpStatus: res.status,
      providerBody: res.text
    });
  }

  let parsed: CoraTokenResponse;
  try {
    parsed = JSON.parse(res.text) as CoraTokenResponse;
  } catch {
    throw new GatewayAuthError("cora", "Resposta de token invalida.");
  }

  const token = parsed.access_token?.trim();
  if (!token) {
    throw new GatewayAuthError("cora", "access_token ausente na resposta Cora.");
  }

  await setCachedOAuthToken("cora", ctx.tenantId, token, parsed.expires_in ?? 86400, 300);
  return token;
}
