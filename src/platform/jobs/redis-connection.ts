import type { ConnectionOptions } from "bullmq";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

export const redisConnection: ConnectionOptions = {
  url: redisUrl,
  ...(process.env.NODE_ENV === "test"
    ? {
        maxRetriesPerRequest: 1,
        retryStrategy: () => null,
        enableOfflineQueue: false,
        lazyConnect: true
      }
    : {})
};

/** Alias para workers e codigo legado. */
export function getRedisConnectionOptions(): ConnectionOptions {
  return redisConnection;
}

/** Desliga filas/workers em testes unitarios. */
export function isJobsEnabled(): boolean {
  if (process.env.NODE_ENV === "test") {
    return false;
  }
  if (process.env.ENABLE_BULLMQ_WORKERS === "false") {
    return false;
  }
  return true;
}
