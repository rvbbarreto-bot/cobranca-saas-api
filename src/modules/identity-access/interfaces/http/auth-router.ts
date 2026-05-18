import { Router } from "express";
import { signAccessToken } from "../../application/jwt-service";
import { authJwtMiddleware } from "../../../../platform/http/middleware/auth-jwt-middleware";
import { mockAuthRoutesGate } from "../../../../platform/http/middleware/mock-auth-routes-gate";
import { requireRoles } from "../../../../platform/http/middleware/rbac-middleware";

export const authRouter = Router();

authRouter.post("/token/mock", mockAuthRoutesGate, (req, res) => {
  const tenantId = String(req.tenantContext?.tenantId || "").trim();
  if (!tenantId) {
    res.status(400).json({
      error: "tenant_missing",
      message: "Tenant context obrigatorio para emitir token."
    });
    return;
  }

  const token = signAccessToken({
    sub: "user-dev-owner",
    tid: tenantId,
    roles: ["owner"]
  });

  res.json({
    access_token: token,
    token_type: "Bearer",
    expires_in: 900
  });
});

authRouter.get("/me", authJwtMiddleware, (req, res) => {
  res.json({
    tenant: req.tenantContext,
    auth: req.authContext,
    correlation_id: req.correlationId || null
  });
});

authRouter.get(
  "/admin-only",
  authJwtMiddleware,
  requireRoles("owner", "admin"),
  (req, res) => {
    res.json({
      ok: true,
      message: "Acesso autorizado para owner/admin.",
      tenant_id: req.tenantContext?.tenantId
    });
  }
);
