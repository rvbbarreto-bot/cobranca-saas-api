import type { ConnectionOptions } from "bullmq";

export const redisConnection: ConnectionOptions = {
  url: process.env.REDIS_URL ?? "redis://localhost:6379"
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
