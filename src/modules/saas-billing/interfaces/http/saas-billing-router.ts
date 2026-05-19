import { Router } from "express";
import { asyncHandler } from "../../../../platform/http/async-handler";
import { authJwtMiddleware } from "../../../../platform/http/middleware/auth-jwt-middleware";
import { requireRoles } from "../../../../platform/http/middleware/rbac-middleware";
import { getPool } from "../../../../platform/persistence/pool";
import { getPlatformMetricsUseCase } from "../../application/get-platform-metrics";
import { listPlansUseCase } from "../../application/list-plans";

export const saasBillingRouter = Router();

/** Catálogo global de planos (administração da plataforma). */
saasBillingRouter.get(
  "/plans",
  authJwtMiddleware,
  requireRoles("owner", "admin"),
  asyncHandler(async (_req, res) => {
    const pool = getPool();
    const plans = await listPlansUseCase(pool);
    res.status(200).json({ data: plans });
  })
);

/** Métricas da plataforma (MRR, assinaturas) — somente owner. */
saasBillingRouter.get(
  "/metrics",
  authJwtMiddleware,
  requireRoles("owner"),
  asyncHandler(async (_req, res) => {
    const pool = getPool();
    const metrics = await getPlatformMetricsUseCase(pool);
    res.status(200).json({ metrics });
  })
);
