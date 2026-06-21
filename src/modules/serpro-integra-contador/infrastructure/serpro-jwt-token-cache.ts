type CacheEntry = {
  token: string;
  expiresAtMs: number;
};

const cache = new Map<string, CacheEntry>();

export function getCachedSerproJwtToken(cacheKey: string): string | null {
  const entry = cache.get(cacheKey);
  if (!entry) {
    return null;
  }
  if (Date.now() >= entry.expiresAtMs - 60_000) {
    cache.delete(cacheKey);
    return null;
  }
  return entry.token;
}

export function setCachedSerproJwtToken(
  cacheKey: string,
  token: string,
  expiresAt: Date | null
): void {
  const fallback = Date.now() + 12 * 60 * 60 * 1000;
  const expiresAtMs = expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt.getTime() : fallback;
  cache.set(cacheKey, { token, expiresAtMs });
}

export function clearSerproJwtTokenCache(): void {
  cache.clear();
}
