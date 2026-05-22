import type https from "node:https";
import { GatewayAuthError } from "../../domain/payment-gateway-error";
import type { GatewayAdapterContext } from "../../domain/gateway-types";
import { getCachedOAuthToken, setCachedOAuthToken } from "../../../../platform/payment-gateway/oauth-token-cache";
import { mtlsFetch } from "../../../../platform/payment-gateway/mtls-fetch";
import type { InterTokenResponse } from "./inter-types";

const INTER_SANDBOX_BASE = "https://cdpj-sandbox.partners.uatinter.co";
const INTER_PROD_BASE = "https://cdpj.partners.bancointer.com.br";

export function interBaseUrl(sandbox: boolean): string {
  return sandbox ? INTER_SANDBOX_BASE : INTER_PROD_BASE;
}

export async function getInterAccessToken(
  ctx: GatewayAdapterContext,
  agent: https.Agent
): Promise<string> {
  const cached = await getCachedOAuthToken("inter", ctx.tenantId);
  if (cached) return cached;

  const clientId = ctx.credentials.client_id?.trim();
  const clientSecret = ctx.credentials.client_secret?.trim();
  if (!clientId || !clientSecret) {
    throw new GatewayAuthError("inter", "client_id e client_secret obrigatorios.");
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope: "boleto-cobranca.write boleto-cobranca.read"
  }).toString();

  const base = interBaseUrl(ctx.sandbox);
  const res = await mtlsFetch(`${base}/oauth/v2/token`, {
    method: "POST",
    agent,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  if (res.status < 200 || res.status >= 300) {
    throw new GatewayAuthError("inter", `Token HTTP ${res.status}`, {
      httpStatus: res.status,
      providerBody: res.text
    });
  }

  let parsed: InterTokenResponse;
  try {
    parsed = JSON.parse(res.text) as InterTokenResponse;
  } catch {
    throw new GatewayAuthError("inter", "Resposta de token invalida.");
  }

  const token = parsed.access_token?.trim();
  if (!token) {
    throw new GatewayAuthError("inter", "access_token ausente na resposta Inter.");
  }

  await setCachedOAuthToken("inter", ctx.tenantId, token, parsed.expires_in ?? 3600, 60);
  return token;
}
