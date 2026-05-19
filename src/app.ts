import "dotenv/config";
import express from "express";
import { asyncHandler } from "./platform/http/async-handler";
import { correlationIdMiddleware } from "./platform/http/middleware/correlation-id";
import { httpAccessLogMiddleware } from "./platform/http/middleware/http-access-log-middleware";
import { optionalPortalCorsMiddleware } from "./platform/http/middleware/optional-cors-middleware";
import { tenantResolutionMiddleware } from "./platform/http/middleware/tenant-resolution-middleware";
import { authRouter } from "./modules/identity-access/interfaces/http/auth-router";
import { tenantRouter } from "./modules/tenant-provisioning/interfaces/http/tenant-router";
import { billingRouter } from "./modules/billing-core/interfaces/http/billing-router";
import { inboxRouter } from "./modules/inbox/interfaces/http/inbox-router";
import { createPortalRouter } from "./modules/portal-read/interfaces/http/portal-router";
import { saasBillingRouter } from "./modules/saas-billing/interfaces/http/saas-billing-router";
import { healthReadyHandler } from "./platform/health/readiness-http";

/**
 * API focada em cobranca / portal / inbox (pacote importado do desenvolvimento EmissaoNF).
 * Sem rota fiscal interna — ver repositorio origem se precisar de `/internal/fiscal`.
 */
export function createApp() {
  const app = express();

  app.use(correlationIdMiddleware);
  app.use(httpAccessLogMiddleware);
  app.use(optionalPortalCorsMiddleware);

  app.get("/health", (_req, res) => {
    res.json({
      status: "ok",
      service: "cobranca-saas-api"
    });
  });

  app.get("/health/ready", asyncHandler(healthReadyHandler));

  const v1 = express.Router();
  v1.use(express.json({ limit: "2mb" }));
  v1.use("/portal", createPortalRouter());
  v1.use(asyncHandler(tenantResolutionMiddleware));

  v1.use("/auth", authRouter);
  v1.use("/tenants", tenantRouter);
  v1.use("/billing", billingRouter);
  v1.use("/saas", saasBillingRouter);
  v1.use("/inbox", inboxRouter);

  app.use("/v1", v1);

  app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const message = error instanceof Error ? error.message : "Erro interno";
    res.status(500).json({
      error: "internal_error",
      message
    });
  });

  return app;
}
