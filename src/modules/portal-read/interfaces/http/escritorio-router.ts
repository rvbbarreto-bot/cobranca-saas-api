import { Router } from "express";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../../platform/http/async-handler";
import { auditContextFromRequest } from "../../../../platform/audit/audit-context";
import { withTenantTransaction } from "../../../../platform/persistence/with-tenant-transaction";
import { getPublicTenantIdForAutomacao } from "../../infrastructure/billing-tenant-link-repository";
import {
  getEscritorioConfigUseCase,
  patchEscritorioConfigUseCase
} from "../../application/escritorio-config-use-cases";
import {
  createChargingRule,
  deleteChargingRule,
  listChargingRules,
  patchChargingRule
} from "../../application/charging-rules-use-cases";
import {
  listNotificationTemplates,
  patchNotificationTemplate,
  previewNotificationTemplate
} from "../../application/notification-templates-use-cases";

function isEscritorioAdmin(req: Request): boolean {
  return req.portalMembership?.role === "admin_escritorio";
}

async function resolvePublicTenant(req: Request, res: Response): Promise<string | null> {
  const automacaoTenantId = req.tenantContext?.tenantId;
  if (!automacaoTenantId) {
    res.status(500).json({ error: "internal_error", message: "Tenant portal ausente." });
    return null;
  }
  const publicTenantId = await getPublicTenantIdForAutomacao(automacaoTenantId);
  if (!publicTenantId) {
    res.status(409).json({
      error: "billing_link_missing",
      message: "Configure portal.billing_tenant_link."
    });
    return null;
  }
  return publicTenantId;
}

export function createEscritorioRouter(): Router {
  const router = Router();

  router.get(
    "/config",
    asyncHandler(async (req, res) => {
      if (!isEscritorioAdmin(req)) {
        res.status(403).json({ error: "portal_forbidden", message: "Apenas admin_escritorio." });
        return;
      }
      const tenantId = await resolvePublicTenant(req, res);
      if (!tenantId) return;
      const config = await withTenantTransaction(tenantId, (client) =>
        getEscritorioConfigUseCase(client, tenantId)
      );
      res.json({ config });
    })
  );

  router.patch(
    "/config",
    asyncHandler(async (req, res) => {
      if (!isEscritorioAdmin(req)) {
        res.status(403).json({ error: "portal_forbidden", message: "Apenas admin_escritorio." });
        return;
      }
      const tenantId = await resolvePublicTenant(req, res);
      if (!tenantId) return;
      try {
        const audit = auditContextFromRequest(req);
        const config = await withTenantTransaction(tenantId, (client) =>
          patchEscritorioConfigUseCase(client, tenantId, req.body, audit)
        );
        res.json({ config });
      } catch (error: unknown) {
        const err = error as Error & { issues?: unknown };
        if (err.message === "VALIDATION_ERROR") {
          res.status(422).json({ error: "validation_error", issues: err.issues });
          return;
        }
        throw error;
      }
    })
  );

  router.get(
    "/regua",
    asyncHandler(async (req, res) => {
      if (!isEscritorioAdmin(req)) {
        res.status(403).json({ error: "portal_forbidden", message: "Apenas admin_escritorio." });
        return;
      }
      const tenantId = await resolvePublicTenant(req, res);
      if (!tenantId) return;
      const rules = await withTenantTransaction(tenantId, (client) =>
        listChargingRules(client, tenantId)
      );
      res.json({ data: rules });
    })
  );

  router.post(
    "/regua",
    asyncHandler(async (req, res) => {
      if (!isEscritorioAdmin(req)) {
        res.status(403).json({ error: "portal_forbidden", message: "Apenas admin_escritorio." });
        return;
      }
      const tenantId = await resolvePublicTenant(req, res);
      if (!tenantId) return;
      try {
        const audit = auditContextFromRequest(req);
        const rule = await withTenantTransaction(tenantId, (client) =>
          createChargingRule(client, tenantId, req.body, audit)
        );
        res.status(201).json({ rule });
      } catch (error: unknown) {
        const err = error as Error & { issues?: unknown };
        if (err.message === "VALIDATION_ERROR") {
          res.status(422).json({ error: "validation_error", issues: err.issues });
          return;
        }
        if (err.message === "DUPLICATE_RULE") {
          res.status(409).json({ error: "duplicate_rule", message: "Regra ja existe." });
          return;
        }
        throw error;
      }
    })
  );

  router.patch(
    "/regua/:ruleId",
    asyncHandler(async (req, res) => {
      if (!isEscritorioAdmin(req)) {
        res.status(403).json({ error: "portal_forbidden", message: "Apenas admin_escritorio." });
        return;
      }
      const tenantId = await resolvePublicTenant(req, res);
      if (!tenantId) return;
      const ruleId = String(req.params.ruleId ?? "").trim();
      try {
        const audit = auditContextFromRequest(req);
        const rule = await withTenantTransaction(tenantId, (client) =>
          patchChargingRule(client, tenantId, ruleId, req.body, audit)
        );
        res.json({ rule });
      } catch (error: unknown) {
        const err = error as Error;
        if (err.message === "NOT_FOUND") {
          res.status(404).json({ error: "not_found" });
          return;
        }
        throw error;
      }
    })
  );

  router.delete(
    "/regua/:ruleId",
    asyncHandler(async (req, res) => {
      if (!isEscritorioAdmin(req)) {
        res.status(403).json({ error: "portal_forbidden", message: "Apenas admin_escritorio." });
        return;
      }
      const tenantId = await resolvePublicTenant(req, res);
      if (!tenantId) return;
      const ruleId = String(req.params.ruleId ?? "").trim();
      try {
        const audit = auditContextFromRequest(req);
        await withTenantTransaction(tenantId, (client) =>
          deleteChargingRule(client, tenantId, ruleId, audit)
        );
        res.status(204).send();
      } catch (error: unknown) {
        if ((error as Error).message === "NOT_FOUND") {
          res.status(404).json({ error: "not_found" });
          return;
        }
        throw error;
      }
    })
  );

  router.get(
    "/templates",
    asyncHandler(async (req, res) => {
      if (!isEscritorioAdmin(req)) {
        res.status(403).json({ error: "portal_forbidden", message: "Apenas admin_escritorio." });
        return;
      }
      const tenantId = await resolvePublicTenant(req, res);
      if (!tenantId) return;
      const data = await withTenantTransaction(tenantId, (client) =>
        listNotificationTemplates(client, tenantId)
      );
      res.json({ data });
    })
  );

  router.patch(
    "/templates/:templateId",
    asyncHandler(async (req, res) => {
      if (!isEscritorioAdmin(req)) {
        res.status(403).json({ error: "portal_forbidden", message: "Apenas admin_escritorio." });
        return;
      }
      const tenantId = await resolvePublicTenant(req, res);
      if (!tenantId) return;
      const templateId = String(req.params.templateId ?? "").trim();
      try {
        const template = await withTenantTransaction(tenantId, (client) =>
          patchNotificationTemplate(client, tenantId, templateId, req.body)
        );
        res.json({ template });
      } catch (error: unknown) {
        const err = error as Error & { issues?: unknown };
        if (err.message === "SYSTEM_TEMPLATE_READONLY") {
          res.status(422).json({ error: "system_template_readonly" });
          return;
        }
        if (err.message === "VALIDATION_ERROR") {
          res.status(422).json({ error: "validation_error", issues: err.issues });
          return;
        }
        throw error;
      }
    })
  );

  router.get(
    "/templates/:templateId/preview",
    asyncHandler(async (req, res) => {
      if (!isEscritorioAdmin(req)) {
        res.status(403).json({ error: "portal_forbidden", message: "Apenas admin_escritorio." });
        return;
      }
      const tenantId = await resolvePublicTenant(req, res);
      if (!tenantId) return;
      const templateId = String(req.params.templateId ?? "").trim();
      const chargeId = typeof req.query.charge_id === "string" ? req.query.charge_id.trim() : "";
      if (!chargeId) {
        res.status(400).json({ error: "invalid_request", message: "charge_id obrigatorio." });
        return;
      }
      try {
        const preview = await withTenantTransaction(tenantId, (client) =>
          previewNotificationTemplate(client, tenantId, templateId, chargeId)
        );
        res.json(preview);
      } catch (error: unknown) {
        const err = error as Error;
        if (err.message === "CHARGE_NOT_FOUND") {
          res.status(404).json({ error: "charge_not_found" });
          return;
        }
        throw error;
      }
    })
  );

  return router;
}
