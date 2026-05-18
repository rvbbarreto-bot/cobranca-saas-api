import type { Request, Response } from "express";
import { getPool } from "../persistence/pool";
import { databaseUrlIndicatesTls, shouldEnforceDatabaseTlsInChecks } from "./database-url-tls";
import { probeDatabase } from "./database-probe";

const READY_TIMEOUT_MS = Math.min(Math.max(Number(process.env.HEALTH_READY_DB_TIMEOUT_MS) || 3000, 500), 15_000);

/**
 * GET /health/ready — readiness com ping ao Postgres e objetos minimos do schema.
 * Nao exige tenant nem JWT. Orquestradores (K8s) devem usar timeout >= READY_TIMEOUT_MS.
 */
export async function healthReadyHandler(_req: Request, res: Response): Promise<void> {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    res.status(503).json({
      status: "unavailable",
      reason: "database_config_missing",
      checks: null
    });
    return;
  }

  if (shouldEnforceDatabaseTlsInChecks() && !databaseUrlIndicatesTls(url)) {
    res.status(503).json({
      status: "unavailable",
      reason: "database_tls_not_indicated",
      message:
        "DATABASE_URL nao indica TLS (ex.: sslmode=require). Defina ou use ALLOW_INSECURE_DATABASE_URL=1 apenas em dev.",
      checks: null
    });
    return;
  }

  try {
    const pool = getPool();
    const result = await probeDatabase(pool, READY_TIMEOUT_MS);

    if (!result.ok) {
      res.status(503).json({
        status: "unavailable",
        reason: "database_probe_failed",
        message: result.error ?? "probe_failed",
        latency_ms: result.latencyMs,
        checks: result.checks
      });
      return;
    }

    res.status(200).json({
      status: "ok",
      service: "cobranca-saas-api",
      latency_ms: result.latencyMs,
      checks: result.checks
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "pool_error";
    res.status(503).json({
      status: "unavailable",
      reason: "database_pool_error",
      message,
      checks: null
    });
  }
}
