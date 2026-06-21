import { serproHttpsRequest } from "./serpro-http-fetch";

type CachedSapiTokens = {
  accessToken: string;
  jwtToken: string;
  expiresAtMs: number;
};

const cache = new Map<string, CachedSapiTokens>();

export function serproSapiAuthUrl(): string {
  return (
    process.env.SERPRO_SAPI_AUTH_URL?.trim() ||
    "https://autenticacao.sapi.serpro.gov.br/authenticate"
  ).replace(/\/$/, "");
}

/** OAuth SAPI com mTLS e-CNPJ — retorna access_token + jwt_token (doc SERPRO quick_start). */
export async function getSerproSapiTokens(input: {
  cacheKey: string;
  consumerKey: string;
  consumerSecret: string;
  certificadoPem: string;
  chavePrivadaPem: string;
}): Promise<{ accessToken: string; jwtToken: string }> {
  const hit = cache.get(input.cacheKey);
  if (hit && hit.expiresAtMs > Date.now() + 30_000) {
    return { accessToken: hit.accessToken, jwtToken: hit.jwtToken };
  }

  const basic = Buffer.from(`${input.consumerKey}:${input.consumerSecret}`).toString("base64");
  const res = await serproHttpsRequest(
    serproSapiAuthUrl(),
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Role-Type": "TERCEIROS",
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: "grant_type=client_credentials"
    },
    {
      certPem: input.certificadoPem,
      keyPem: input.chavePrivadaPem
    }
  );

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`SERPRO_SAPI_AUTH_FALHOU: HTTP ${res.status} ${text.slice(0, 400)}`);
  }

  const parsed = JSON.parse(text) as {
    access_token?: string;
    jwt_token?: string;
    expires_in?: number;
  };
  if (!parsed.access_token?.trim() || !parsed.jwt_token?.trim()) {
    throw new Error(
      "SERPRO_SAPI_SEM_TOKENS — resposta deve incluir access_token e jwt_token (autentique com e-CNPJ do contratante)."
    );
  }

  const ttlSec = typeof parsed.expires_in === "number" ? parsed.expires_in : 3600;
  cache.set(input.cacheKey, {
    accessToken: parsed.access_token,
    jwtToken: parsed.jwt_token,
    expiresAtMs: Date.now() + ttlSec * 1000
  });

  return { accessToken: parsed.access_token, jwtToken: parsed.jwt_token };
}

export function clearSerproSapiTokenCacheForTests(): void {
  cache.clear();
}
