import type { NextFunction, Request, Response } from "express";

/**
 * CORS para `/v1/portal/*` (ex.: SPA portal em `localhost:5173` ou dominio publicado).
 *
 * - Se `CORS_ORIGIN` estiver definido no `.env`, usa esse valor (`*` ou URLs separadas por vírgula).
 * - Se **não** estiver definido e `NODE_ENV !== "production"`, assume `*` só em rotas portal (facilita dev + trycloudflare).
 * - Em produção, sem `CORS_ORIGIN`, não envia headers CORS (comportamento fechado).
 */
export function optionalPortalCorsMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!req.path.startsWith("/v1/portal")) {
    next();
    return;
  }

  const explicit = process.env.CORS_ORIGIN?.trim();
  const effective =
    explicit || (process.env.NODE_ENV !== "production" ? "*" : "");

  if (!effective) {
    next();
    return;
  }

  const allowed = effective.split(",").map((s) => s.trim()).filter(Boolean);
  const requestOrigin = req.header("origin");

  let allow: string | undefined;
  if (allowed.includes("*")) {
    allow = "*";
  } else if (requestOrigin && allowed.includes(requestOrigin)) {
    allow = requestOrigin;
  }

  if (allow) {
    res.setHeader("Access-Control-Allow-Origin", allow);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, x-tenant-id, x-correlation-id"
    );
    res.setHeader("Access-Control-Max-Age", "86400");
  }

  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }

  next();
}
