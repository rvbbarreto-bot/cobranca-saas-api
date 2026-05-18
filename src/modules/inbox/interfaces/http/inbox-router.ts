import { Router } from "express";
import { getWebhookInboxSecret, isWebhookInboxSecretRequired } from "../../../../platform/config/runtime-flags";
import { asyncHandler } from "../../../../platform/http/async-handler";
import { webhookRateLimit } from "../../../../platform/http/middleware/rate-limit.middleware";
import { authJwtMiddleware } from "../../../../platform/http/middleware/auth-jwt-middleware";
import { requireRoles } from "../../../../platform/http/middleware/rbac-middleware";
import { withTenantTransaction } from "../../../../platform/persistence/with-tenant-transaction";
import { scheduleWebhookProcessJob } from "../../../../platform/jobs/enqueue-webhook-process";
import { processPendingWebhooksForTenant } from "../../application/process-webhook-inbox";
import { insertWebhookInbox } from "../../infrastructure/webhook-inbox-repository";

export const inboxRouter = Router();

inboxRouter.post(
  "/webhooks/process-pending",
  authJwtMiddleware,
  requireRoles("owner", "admin", "finance", "service_account"),
  asyncHandler(async (req, res) => {
    const tenantId = req.tenantContext?.tenantId;
    if (!tenantId) {
      res.status(400).json({ error: "tenant_missing", message: "Tenant obrigatorio." });
      return;
    }

    const limit = Math.min(Number(req.query.limit) || 25, 100);
    const result = await processPendingWebhooksForTenant(tenantId, limit);
    res.json(result);
  })
);

/**
 * Entrada de eventos externos (n8n, banco, etc.).
 * Autenticacao: opcional X-Webhook-Secret quando WEBHOOK_INBOX_SECRET estiver definido.
 * Tenant: obrigatorio via x-tenant-id (mesmo fluxo das demais rotas /v1).
 */
inboxRouter.post(
  "/webhooks",
  webhookRateLimit,
  asyncHandler(async (req, res) => {
    const expected = getWebhookInboxSecret();
    if (isWebhookInboxSecretRequired() && !expected) {
      res.status(503).json({
        error: "webhook_inbox_misconfigured",
        message: "WEBHOOK_INBOX_SECRET e obrigatorio quando NODE_ENV=production."
      });
      return;
    }

    if (expected) {
      const got = req.header("x-webhook-secret")?.trim();
      if (got !== expected) {
        res.status(401).json({
          error: "invalid_webhook_secret",
          message: "Credencial de webhook invalida."
        });
        return;
      }
    }

    const tenantId = req.tenantContext?.tenantId;
    if (!tenantId) {
      res.status(400).json({ error: "tenant_missing" });
      return;
    }

    const externalEventId =
      req.header("x-external-event-id")?.trim() ||
      (typeof req.body?.external_event_id === "string" ? req.body.external_event_id.trim() : undefined);

    const body = req.body ?? {};
    const source =
      typeof body.source === "string"
        ? body.source
        : typeof body.event === "string" && body.payment
          ? "asaas"
          : "n8n";

    const result = await withTenantTransaction(tenantId, async (client) =>
      insertWebhookInbox(client, {
        source,
        externalEventId: externalEventId || null,
        payload: body,
        correlationId: req.correlationId ?? null
      })
    );

    if (result.inserted) {
      scheduleWebhookProcessJob({ tenantId });
    }

    const silentDuplicate = !result.inserted && result.alreadyProcessed;
    res.status(result.inserted ? 202 : 200).json({
      accepted: true,
      deduplicated: !result.inserted,
      already_processed: silentDuplicate,
      id: result.row?.id
    });
  })
);
