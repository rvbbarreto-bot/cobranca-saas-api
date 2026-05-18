import { createClient } from "redis";

export type RedisClient = ReturnType<typeof createClient>;

let redisClient: RedisClient | null = null;
let connectPromise: Promise<RedisClient | null> | null = null;

function redisUrlConfigured(): boolean {
  return Boolean(process.env.REDIS_URL?.trim());
}

/** Cliente Redis compartilhado (rate limit, filas). Null se REDIS_URL ausente ou NODE_ENV=test. */
export async function connectRedis(): Promise<RedisClient | null> {
  if (process.env.NODE_ENV === "test" || !redisUrlConfigured()) {
    return null;
  }
  if (redisClient?.isOpen) {
    return redisClient;
  }
  if (!connectPromise) {
    const url = process.env.REDIS_URL!.trim();
    connectPromise = (async () => {
      const client = createClient({ url });
      client.on("error", (err) => {
        // eslint-disable-next-line no-console
        console.error("[redis]", err.message);
      });
      await client.connect();
      redisClient = client;
      return client;
    })().catch((err: unknown) => {
      connectPromise = null;
      throw err;
    });
  }
  return connectPromise;
}

/** Uso em sendCommand do rate-limit-redis (apos connectRedis no boot). */
export function getRedisClient(): RedisClient {
  if (!redisClient?.isOpen) {
    throw new Error("Redis nao conectado; chame connectRedis() no boot ou defina REDIS_URL.");
  }
  return redisClient;
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient?.isOpen) {
    await redisClient.quit();
  }
  redisClient = null;
  connectPromise = null;
}
