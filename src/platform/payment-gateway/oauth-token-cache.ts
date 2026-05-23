import { connectRedis } from "../persistence/redis";

export type OAuthTokenCacheEntry = {
  accessToken: string;
  expiresAtMs: number;
};

export type OAuthTokenCacheDeps = {
  get?: (key: string) => Promise<string | null>;
  set?: (key: string, value: string, ttlSeconds: number) => Promise<void>;
};

function cacheKey(provider: string, tenantId: string): string {
  return `gw_token:${provider}:${tenantId}`;
}

export async function getCachedOAuthToken(
  provider: string,
  tenantId: string,
  deps: OAuthTokenCacheDeps = {}
): Promise<string | null> {
  const key = cacheKey(provider, tenantId);
  if (deps.get) {
    const raw = await deps.get(key);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as OAuthTokenCacheEntry;
      if (parsed.expiresAtMs > Date.now() + 5_000) {
        return parsed.accessToken;
      }
    } catch {
      return null;
    }
    return null;
  }

  const redis = await connectRedis();
  if (!redis) return null;
  const raw = await redis.get(key);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as OAuthTokenCacheEntry;
    if (parsed.expiresAtMs > Date.now() + 5_000) {
      return parsed.accessToken;
    }
  } catch {
    return null;
  }
  return null;
}

export async function setCachedOAuthToken(
  provider: string,
  tenantId: string,
  accessToken: string,
  expiresInSeconds: number,
  marginSeconds: number,
  deps: OAuthTokenCacheDeps = {}
): Promise<void> {
  const ttl = Math.max(30, expiresInSeconds - marginSeconds);
  const entry: OAuthTokenCacheEntry = {
    accessToken,
    expiresAtMs: Date.now() + ttl * 1000
  };
  const key = cacheKey(provider, tenantId);
  const payload = JSON.stringify(entry);

  if (deps.set) {
    await deps.set(key, payload, ttl);
    return;
  }

  const redis = await connectRedis();
  if (!redis) return;
  await redis.setEx(key, ttl, payload);
}
