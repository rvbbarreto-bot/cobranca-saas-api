import type { NextFunction, Request, Response } from "express";
import { shouldEmitHttpAccessJsonLog } from "../../config/runtime-flags";

/**
 * Log estruturado (uma linha JSON) por requisicao HTTP ao finalizar a resposta.
 * Facilita agregacao em Loki/Datadog/CloudWatch sem alterar handlers de negocio.
 */
export function httpAccessLogMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!shouldEmitHttpAccessJsonLog()) {
    next();
    return;
  }

  const started = process.hrtime.bigint();
  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - started) / 1_000_000;
    const line = {
      level: "info",
      msg: "http_access",
      method: req.method,
      path: req.originalUrl?.split("?")[0] ?? req.url,
      status: res.statusCode,
      duration_ms: Math.round(durationMs * 1000) / 1000,
      correlation_id: req.correlationId ?? null
    };
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(line));
  });

  next();
}
