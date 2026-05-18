import type { Request, RequestHandler } from "express";
import rateLimit, { type Options, type RateLimitRequestHandler, type Store } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { connectRedis } from "../../persistence/redis";

const RATE_LIMIT_MESSAGE = {
  error: {
    code: "RATE_LIMIT_EXCEEDED",
    message: "Muitas tentativas. Tente novamente em 1 minuto."
  }
} as const;

let redisStore: Store | undefined;

function noopRateLimit(): RequestHandler {
  return (_req, _res, next) => next();
}

function makeLazyLimiter(buildOptions: () => Partial<Options>): RequestHandler {
  if (process.env.NODE_ENV === "test") {
    return noopRateLimit();
  }

  let handler: RateLimitRequestHandler | null = null;
  return (req, res, next) => {
    if (!handler) {
      handler = rateLimit({
        windowMs: 60_000,
        standardHeaders: true,
        legacyHeaders: false,
        message: RATE_LIMIT_MESSAGE,
        ...buildOptions(),
        ...(redisStore ? { store: redisStore } : {})
      });
    }
    return handler(req, res, next);
  };
}

/** POST /v1/portal/auth/login — 10 req/min por IP. */
export const authRateLimit = makeLazyLimiter(() => ({
  max: 10,
  keyGenerator: (req: Request) => req.ip ?? "unknown"
}));

/** POST /v1/inbox/webhooks — 100 req/min por tenant ou IP. */
export const webhookRateLimit = makeLazyLimiter(() => ({
  max: 100,
  keyGenerator: (req: Request) => {
    const tenant = req.header("x-tenant-id")?.trim();
    return tenant || req.ip || "unknown";
  }
}));

/** Conecta Redis e prepara store compartilhado (chamar antes de aceitar trafego). */
export async function initRateLimitRedis(): Promise<void> {
  if (process.env.NODE_ENV === "test" || !process.env.REDIS_URL?.trim()) {
    return;
  }
  const client = await connectRedis();
  if (client) {
    redisStore = new RedisStore({
      sendCommand: (...args: string[]) => client.sendCommand(args)
    });
  }
}
