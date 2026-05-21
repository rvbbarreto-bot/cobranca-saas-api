import { withTenantTransaction } from "../../../platform/persistence/with-tenant-transaction";
import { writeAuditLog } from "../../../platform/audit/audit.service";
import {
  applyWebhookSideEffectPlan,
  type WebhookSideEffectPlan
} from "../../../platform/jobs/application/webhook-side-effects";
import { insertChargeEvent } from "../../billing-core/infrastructure/charge-events-repository";
import {
  isWebhookInboxProcessed,
  listPendingWebhookInbox,
  markWebhookInboxDead,
  markWebhookInboxProcessed
} from "../infrastructure/webhook-inbox-repository";
import { updateChargeCanonicalStatus } from "../../billing-core/infrastructure/charge-repository";
import { applyAsaasPlatformSubscriptionWebhook } from "../../saas-billing/application/process-asaas-platform-subscription-webhook";
import { applyAsaasWebhookEvent } from "./process-asaas-webhook-event";
import { parseWebhookChargeInstruction } from "./parse-webhook-charge-instruction";

export type ProcessWebhookInboxResult = {
  scanned: number;
  updated: number;
  dead: number;
  dead_parse: number;
  dead_not_found: number;
  dead_illegal_transition: number;
  skipped_already_processed: number;
};

function summarizeIssues(issues: string[]): string {
  const t = issues.join("; ");
  return t.length > 2000 ? `${t.slice(0, 2000)}…` : t;
}

/**
 * Processa fila `webhook_inbox` do tenant (RLS), atualizando `charges` quando o payload segue o contrato documentado.
 */
export async function processPendingWebhooksForTenant(
  tenantUuid: string,
  limit: number
): Promise<ProcessWebhookInboxResult> {
  const sideEffects: WebhookSideEffectPlan[] = [];

  const result = await withTenantTransaction(tenantUuid, async (client) => {
    const rows = await listPendingWebhookInbox(client, limit);
    let updated = 0;
    let dead = 0;
    let deadParse = 0;
    let deadNotFound = 0;
    let deadIllegal = 0;
    let skippedAlready = 0;

    for (const row of rows) {
      if (row.processedAt || (await isWebhookInboxProcessed(client, row.id))) {
        skippedAlready += 1;
        continue;
      }

      const parsed = parseWebhookChargeInstruction(row.payload);
      if (!parsed.ok) {
        await markWebhookInboxDead(client, row.id, summarizeIssues(parsed.issues));
        dead += 1;
        deadParse += 1;
        continue;
      }

      if (parsed.format === "platform_subscription" && parsed.platformSubscriptionContext) {
        const platformResult = await applyAsaasPlatformSubscriptionWebhook(
          client,
          parsed.platformSubscriptionContext
        );

        if (platformResult.outcome === "not_found") {
          await markWebhookInboxDead(client, row.id, "NO_MATCHING_SAAS_SUBSCRIPTION");
          deadNotFound += 1;
          dead += 1;
          continue;
        }

        await markWebhookInboxProcessed(client, row.id);
        if (platformResult.outcome === "applied") {
          updated += 1;
        }
        continue;
      }

      if (parsed.format === "asaas" && parsed.asaasContext) {
        const asaasResult = await applyAsaasWebhookEvent(client, tenantUuid, parsed.asaasContext);

        if (asaasResult.outcome === "not_found") {
          await markWebhookInboxDead(client, row.id, "NO_MATCHING_CHARGE");
          deadNotFound += 1;
          dead += 1;
          continue;
        }

        if (asaasResult.outcome === "illegal_transition") {
          await markWebhookInboxDead(
            client,
            row.id,
            `ILLEGAL_TRANSITION:${asaasResult.from}->${asaasResult.to}`
          );
          deadIllegal += 1;
          dead += 1;
          continue;
        }

        await markWebhookInboxProcessed(client, row.id);
        if (asaasResult.outcome === "applied") {
          updated += 1;
          sideEffects.push(asaasResult.sideEffect);
        }
        continue;
      }

      const before = await client.query<{ canonical_status: string; id: string }>(
        `SELECT id::text AS id, canonical_status
         FROM charges
         WHERE tenant_id = current_setting('app.tenant_id', true)::uuid
           AND (
             ($1::text IS NOT NULL AND reference = $1)
             OR ($2::text IS NOT NULL AND provider_charge_id = $2)
           )
         LIMIT 1`,
        [parsed.value.reference ?? null, parsed.value.providerChargeId ?? null]
      );
      const beforeRow = before.rows[0];

      const outcome = await updateChargeCanonicalStatus(client, {
        canonicalStatus: parsed.value.canonicalStatus,
        reference: parsed.value.reference,
        providerChargeId: parsed.value.providerChargeId
      });

      if (!outcome.ok) {
        if (outcome.reason === "illegal_transition") {
          await markWebhookInboxDead(
            client,
            row.id,
            `ILLEGAL_TRANSITION:${outcome.from ?? "?"}->${outcome.to ?? "?"}`
          );
          deadIllegal += 1;
        } else {
          await markWebhookInboxDead(client, row.id, "NO_MATCHING_CHARGE");
          deadNotFound += 1;
        }
        dead += 1;
        continue;
      }

      if (outcome.applied && beforeRow) {
        await insertChargeEvent(client, {
          tenantId: tenantUuid,
          chargeId: beforeRow.id,
          eventType: "webhook_canonical",
          oldStatus: beforeRow.canonical_status as typeof outcome.charge.canonicalStatus,
          newStatus: outcome.charge.canonicalStatus,
          payload: {
            canonical_status: parsed.value.canonicalStatus,
            provider_charge_id: parsed.value.providerChargeId,
            reference: parsed.value.reference
          }
        });

        await writeAuditLog(
          {
            tenantId: tenantUuid,
            action: "status_change",
            resourceType: "charge",
            resourceId: beforeRow.id,
            oldValue: { canonical_status: beforeRow.canonical_status },
            newValue: { canonical_status: outcome.charge.canonicalStatus }
          },
          client
        );

        if (parsed.value.providerChargeId) {
          await client.query(
            `UPDATE payment_transactions
             SET status = $2, updated_at = now()
             WHERE charge_id = $1::uuid
               AND gateway_transaction_id = $3`,
            [beforeRow.id, parsed.value.canonicalStatus, parsed.value.providerChargeId]
          );
        }

        sideEffects.push({
          kind: "generic",
          chargeId: beforeRow.id,
          tenantId: tenantUuid,
          newStatus: outcome.charge.canonicalStatus
        });
      }

      await markWebhookInboxProcessed(client, row.id);
      if (outcome.applied) {
        updated += 1;
      }
    }

    return {
      scanned: rows.length,
      updated,
      dead,
      dead_parse: deadParse,
      dead_not_found: deadNotFound,
      dead_illegal_transition: deadIllegal,
      skipped_already_processed: skippedAlready
    };
  });

  for (const plan of sideEffects) {
    await applyWebhookSideEffectPlan(plan);
  }

  return result;
}
