import { Router } from "express";
import { DatabaseError } from "pg";
import { asyncHandler } from "../../../../platform/http/async-handler";
import { authJwtMiddleware } from "../../../../platform/http/middleware/auth-jwt-middleware";
import { mockAuthRoutesGate } from "../../../../platform/http/middleware/mock-auth-routes-gate";
import { requireRoles } from "../../../../platform/http/middleware/rbac-middleware";
import { getPool } from "../../../../platform/persistence/pool";
import {
  parseProvisionPublicTenantBody,
  provisionPublicTenant
} from "../../application/provision-public-tenant";

export const tenantRouter = Router();

/**
 * Provisiona novo tenant em `public.tenants` (persistido). Opcionalmente cria/atualiza `portal.billing_tenant_link`.
 * JWT core (owner/admin) + x-tenant-id do tenant atual (contexto da chamada).
 */
tenantRouter.post(
  "/provision",
  authJwtMiddleware,
  requireRoles("owner", "admin"),
  asyncHandler(async (req, res) => {
    const parsed = parseProvisionPublicTenantBody(req.body);
    if (!parsed.ok) {
      res.status(400).json({ error: "invalid_body", message: parsed.message });
      return;
    }

    try {
      const pool = getPool();
      const result = await provisionPublicTenant(pool, parsed.value);
      res.status(201).json({
        tenant: {
          id: result.publicTenantId,
          slug: result.slug,
          name: result.name
        },
        billing_linked: result.billingLinked
      });
    } catch (error: unknown) {
      if (error instanceof DatabaseError && error.code === "23505") {
        res.status(409).json({
          error: "unique_violation",
          message: "Slug de tenant ja existe em public.tenants."
        });
        return;
      }
      throw error;
    }
  })
);

tenantRouter.post(
  "/provision/mock",
  mockAuthRoutesGate,
  authJwtMiddleware,
  requireRoles("owner", "admin"),
  (req, res) => {
    const now = new Date().toISOString();
    res.status(201).json({
      message: "Provisionamento mock criado. Substituir por use case real + persistencia.",
      tenant_id: req.tenantContext?.tenantId,
      created_at: now,
      resources: {
        plan: "starter",
        limits: {
          monthly_charges: 1000,
          users: 5
        }
      }
    });
  }
);
