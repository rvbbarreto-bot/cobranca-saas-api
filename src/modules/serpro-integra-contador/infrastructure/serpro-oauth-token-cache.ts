type CachedToken = { accessToken: string; expiresAtMs: number };

const cache = new Map<string, CachedToken>();

export async function getSerproAccessToken(input: {
  cacheKey: string;
  tokenUrl: string;
  consumerKey: string;
  consumerSecret: string;
}): Promise<string> {
  const hit = cache.get(input.cacheKey);
  if (hit && hit.expiresAtMs > Date.now() + 30_000) {
    return hit.accessToken;
  }

  const basic = Buffer.from(`${input.consumerKey}:${input.consumerSecret}`).toString("base64");
  const res = await fetch(input.tokenUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`SERPRO_OAUTH_FALHOU: HTTP ${res.status} ${text.slice(0, 200)}`);
  }

  const parsed = JSON.parse(text) as { access_token?: string; expires_in?: number };
  if (!parsed.access_token) {
    throw new Error("SERPRO_OAUTH_SEM_TOKEN");
  }

  const ttlSec = typeof parsed.expires_in === "number" ? parsed.expires_in : 3600;
  cache.set(input.cacheKey, {
    accessToken: parsed.access_token,
    expiresAtMs: Date.now() + ttlSec * 1000
  });
  return parsed.access_token;
}

export function clearSerproTokenCacheForTests(): void {
  cache.clear();
}
