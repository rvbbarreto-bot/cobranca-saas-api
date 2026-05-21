import type { Request, RequestHandler } from "express";
import rateLimit, {
  ipKeyGenerator,
  type Options,
  type RateLimitRequestHandler,
  type Store
} from "express-rate-limit";
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

/** Vitest/CI usam NODE_ENV=development no workflow; VITEST identifica runner de teste. */
export function isRateLimitDisabled(): boolean {
  return process.env.NODE_ENV === "test" || process.env.VITEST === "true";
}

function baseRateLimitOptions(extra: Partial<Options>): Partial<Options> {
  return {
    windowMs: 60_000,
    standardHeaders: true,
    legacyHeaders: false,
    message: RATE_LIMIT_MESSAGE,
    ...extra,
    ...(redisStore ? { store: redisStore } : {})
  };
}

function createRateLimiter(extra: Partial<Options>): RateLimitRequestHandler {
  return rateLimit(baseRateLimitOptions(extra) as Options);
}

const limiterSlots = {
  auth: noopRateLimit() as RateLimitRequestHandler,
  webhook: noopRateLimit() as RateLimitRequestHandler,
  csvExport: noopRateLimit() as RateLimitRequestHandler
};

function installRateLimiters(): void {
  if (isRateLimitDisabled()) {
    limiterSlots.auth = noopRateLimit() as RateLimitRequestHandler;
    limiterSlots.webhook = noopRateLimit() as RateLimitRequestHandler;
    limiterSlots.csvExport = noopRateLimit() as RateLimitRequestHandler;
    return;
  }

  limiterSlots.auth = createRateLimiter({
    max: 10,
    keyGenerator: (req: Request) => ipKeyGenerator(req.ip ?? "unknown")
  });

  limiterSlots.webhook = createRateLimiter({
    max: 100,
    keyGenerator: (req: Request) => {
      const tenant = req.header("x-tenant-id")?.trim();
      return tenant || ipKeyGenerator(req.ip ?? "unknown");
    }
  });

  limiterSlots.csvExport = createRateLimiter({
    max: 5,
    keyGenerator: (req: Request) => {
      const tenant = req.tenantContext?.tenantId ?? req.header("x-tenant-id")?.trim();
      if (tenant) {
        return `csv-export:${tenant}`;
      }
      return `csv-export:${ipKeyGenerator(req.ip ?? "unknown")}`;
    }
  });
}

installRateLimiters();

/** POST /v1/portal/auth/login — 10 req/min por IP. */
export const authRateLimit: RequestHandler = (req, res, next) =>
  limiterSlots.auth(req, res, next);

/** POST /v1/inbox/webhooks — 100 req/min por tenant ou IP. */
export const webhookRateLimit: RequestHandler = (req, res, next) =>
  limiterSlots.webhook(req, res, next);

/** GET /v1/portal/escritorio/cobrancas/export — 5 req/min por tenant. */
export const escritorioCsvExportRateLimit: RequestHandler = (req, res, next) =>
  limiterSlots.csvExport(req, res, next);

/** Conecta Redis e recria limiters com store compartilhado (chamar antes de aceitar trafego). */
export async function initRateLimitRedis(): Promise<void> {
  if (isRateLimitDisabled() || !process.env.REDIS_URL?.trim()) {
    return;
  }
  const client = await connectRedis();
  if (client) {
    redisStore = new RedisStore({
      sendCommand: (...args: string[]) => client.sendCommand(args)
    });
    installRateLimiters();
  }
}
