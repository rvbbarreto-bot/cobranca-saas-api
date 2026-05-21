import type { PoolClient } from "pg";
import { writeAuditLog } from "../../../platform/audit/audit.service";
import { emitN8nPlatformEvent } from "../../../platform/integrations/n8n-outbound";
import type { SubscriptionStatus } from "../domain/subscription-status";
import {
  getSubscriptionByGatewaySubscriptionId,
  updateSubscriptionFromGateway
} from "../infrastructure/subscriptions-repository";
import type { PlatformSubscriptionWebhookContext } from "./parse-asaas-platform-subscription-webhook";

export type ApplyPlatformSubscriptionWebhookResult =
  | { outcome: "applied"; tenantId: string; oldStatus: string; newStatus: SubscriptionStatus }
  | { outcome: "noop"; tenantId: string }
  | { outcome: "not_found" };

export async function applyAsaasPlatformSubscriptionWebhook(
  client: PoolClient,
  ctx: PlatformSubscriptionWebhookContext
): Promise<ApplyPlatformSubscriptionWebhookResult> {
  const row = await getSubscriptionByGatewaySubscriptionId(client, ctx.gatewaySubscriptionId);

  if (!row) {
    return { outcome: "not_found" };
  }

  if (row.status === ctx.newStatus) {
    return { outcome: "noop", tenantId: row.tenant_id };
  }

  const terminal: SubscriptionStatus[] = ["canceled"];
  if (terminal.includes(row.status) && ctx.newStatus !== "canceled") {
    return { outcome: "noop", tenantId: row.tenant_id };
  }

  const updated = await updateSubscriptionFromGateway(client, {
    tenantId: row.tenant_id,
    status: ctx.newStatus,
    gatewaySubscriptionId: ctx.gatewaySubscriptionId
  });

  await writeAuditLog(
    {
      tenantId: row.tenant_id,
      action: "status_change",
      resourceType: "saas_subscription",
      resourceId: row.id,
      oldValue: { status: row.status, gateway_subscription_id: row.gateway_subscription_id },
      newValue: { status: ctx.newStatus, asaas_event: ctx.event }
    },
    client
  );

  if (ctx.newStatus === "past_due") {
    emitN8nPlatformEvent({
      event: "subscription.past_due",
      occurred_at: new Date().toISOString(),
      tenant_id: row.tenant_id,
      payload: {
        subscription_id: row.id,
        plano_slug: row.plano_slug,
        gateway_subscription_id: ctx.gatewaySubscriptionId
      }
    });
  }

  return {
    outcome: "applied",
    tenantId: row.tenant_id,
    oldStatus: row.status,
    newStatus: updated.status
  };
}
