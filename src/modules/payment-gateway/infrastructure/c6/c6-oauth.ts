import { GatewayAuthError } from "../../domain/payment-gateway-error";
import type { GatewayAdapterContext } from "../../domain/gateway-types";
import { getCachedOAuthToken, setCachedOAuthToken } from "../../../../platform/payment-gateway/oauth-token-cache";
import type { C6TokenResponse } from "./c6-types";

const C6_AUTH_SANDBOX = "https://auth.hm.c6bank.com.br";
const C6_AUTH_PROD = "https://auth.c6bank.com.br";

export function c6AuthBaseUrl(sandbox: boolean): string {
  return sandbox ? C6_AUTH_SANDBOX : C6_AUTH_PROD;
}

export function c6ApiBaseUrl(sandbox: boolean): string {
  const override = process.env.C6_API_BASE_URL?.trim();
  if (override) return override.replace(/\/$/, "");
  return sandbox ? "https://api.hm.c6bank.com.br" : "https://api.c6bank.com.br";
}

function basicAuthHeader(clientId: string, clientSecret: string): string {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`, "utf8").toString("base64")}`;
}

export async function getC6AccessToken(ctx: GatewayAdapterContext): Promise<string> {
  const cached = await getCachedOAuthToken("c6", ctx.tenantId);
  if (cached) return cached;

  const clientId = ctx.credentials.client_id?.trim();
  const clientSecret = ctx.credentials.client_secret?.trim();
  if (!clientId || !clientSecret) {
    throw new GatewayAuthError("c6", "client_id e client_secret obrigatorios.");
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    scope: "cobranca"
  }).toString();

  const url = `${c6AuthBaseUrl(ctx.sandbox)}/oauth/token`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: basicAuthHeader(clientId, clientSecret)
      },
      body
    });
  } catch {
    throw new GatewayAuthError("c6", "Falha de rede no token C6.");
  }

  const text = await response.text();
  if (!response.ok) {
    throw new GatewayAuthError("c6", `Token HTTP ${response.status}`, {
      httpStatus: response.status,
      providerBody: text
    });
  }

  let parsed: C6TokenResponse;
  try {
    parsed = JSON.parse(text) as C6TokenResponse;
  } catch {
    throw new GatewayAuthError("c6", "Resposta de token invalida.");
  }

  const token = parsed.access_token?.trim();
  if (!token) {
    throw new GatewayAuthError("c6", "access_token ausente.");
  }

  await setCachedOAuthToken("c6", ctx.tenantId, token, parsed.expires_in ?? 1800, 60);
  return token;
}
