import { Router } from "express";
import { DatabaseError } from "pg";
import { asyncHandler } from "../../../../platform/http/async-handler";
import { authJwtMiddleware } from "../../../../platform/http/middleware/auth-jwt-middleware";
import { requireRoles } from "../../../../platform/http/middleware/rbac-middleware";
import { auditContextFromRequest } from "../../../../platform/audit/audit-context";
import { withTenantTransaction } from "../../../../platform/persistence/with-tenant-transaction";
import { cancelChargeUseCase } from "../../application/cancel-charge";
import { createChargeUseCase } from "../../application/create-charge";
import { listCharges } from "../../infrastructure/charge-repository";

export const billingRouter = Router();

billingRouter.post(
  "/charges",
  authJwtMiddleware,
  requireRoles("owner", "admin", "finance", "service_account"),
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantContext?.tenantId;
    if (!tenantId) {
      res.status(400).json({ error: "tenant_missing" });
      return;
    }

    try {
      const audit = auditContextFromRequest(req);
      const result = await withTenantTransaction(tenantId, async (client) => {
        return createChargeUseCase(client, req.body, audit);
      });

      res.status(result.inserted ? 201 : 200).json({
        charge: result.charge,
        idempotent: !result.inserted
      });
    } catch (error: unknown) {
      const err = error as Error & { issues?: unknown };
      if (err.message === "VALIDATION_ERROR") {
        res.status(422).json({
          error: "validation_error",
          issues: err.issues
        });
        return;
      }
      if (error instanceof DatabaseError) {
        const pgErr = error;
        if (pgErr.code === "23505") {
          res.status(409).json({
            error: "unique_violation",
            message: "Referencia ou idempotency_key ja existente para este tenant."
          });
          return;
        }
      }
      throw error;
    }
  })
);

billingRouter.post(
  "/charges/:chargeId/cancel",
  authJwtMiddleware,
  requireRoles("owner", "admin", "finance", "service_account"),
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantContext?.tenantId;
    if (!tenantId) {
      res.status(400).json({ error: "tenant_missing" });
      return;
    }

    const chargeId = typeof req.params.chargeId === "string" ? req.params.chargeId.trim() : "";
    if (!chargeId) {
      res.status(400).json({ error: "invalid_request", message: "chargeId ausente." });
      return;
    }

    const audit = auditContextFromRequest(req);
    const result = await withTenantTransaction(tenantId, (client) =>
      cancelChargeUseCase(client, chargeId, audit)
    );

    if (!result.ok) {
      if (result.kind === "not_found") {
        res.status(404).json({ error: "charge_not_found", message: "Cobranca inexistente." });
        return;
      }
      res.status(409).json({
        error: "illegal_status_transition",
        message: `Nao e possivel cancelar cobranca em status ${result.from}.`,
        from: result.from,
        to: result.to
      });
      return;
    }

    res.json({ charge: result.charge });
  })
);

billingRouter.get(
  "/charges",
  authJwtMiddleware,
  requireRoles("owner", "admin", "finance", "support", "viewer", "service_account"),
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantContext?.tenantId;
    if (!tenantId) {
      res.status(400).json({ error: "tenant_missing" });
      return;
    }

    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const charges = await withTenantTransaction(tenantId, async (client) => listCharges(client, limit));
    res.json({ charges });
  })
);
