import type { PoolClient } from "pg";
import { writeAuditLog } from "../../../platform/audit/audit.service";
import type { WebhookSideEffectPlan } from "../../../platform/jobs/application/webhook-side-effects";
import { evaluateChargeStatusTransition } from "../../billing-core/application/charge-status-transition";
import type { CanonicalChargeStatus } from "../../billing-core/domain/charge";
import { insertChargeEvent } from "../../billing-core/infrastructure/charge-events-repository";
import type { AsaasWebhookContext } from "./parse-asaas-webhook-context";

export type ApplyAsaasWebhookResult =
  | { outcome: "applied"; sideEffect: WebhookSideEffectPlan }
  | { outcome: "noop"; sideEffect: WebhookSideEffectPlan }
  | { outcome: "not_found" }
  | { outcome: "illegal_transition"; from: string; to: string };

type ChargeRow = {
  id: string;
  canonical_status: CanonicalChargeStatus;
};

async function findCharge(
  client: PoolClient,
  instruction: AsaasWebhookContext["instruction"]
): Promise<ChargeRow | null> {
  const ref = instruction.reference?.trim() || null;
  const pid = instruction.providerChargeId?.trim() || null;
  const r = await client.query<{ id: string; canonical_status: string }>(
    `SELECT id::text AS id, canonical_status
     FROM charges
     WHERE tenant_id = current_setting('app.tenant_id', true)::uuid
       AND (
         ($1::text IS NOT NULL AND reference = $1)
         OR ($2::text IS NOT NULL AND provider_charge_id = $2)
       )
     LIMIT 1`,
    [ref, pid]
  );
  const row = r.rows[0];
  if (!row) {
    return null;
  }
  return { id: row.id, canonical_status: row.canonical_status as CanonicalChargeStatus };
}

async function syncPaymentTransaction(
  client: PoolClient,
  chargeId: string,
  canonicalStatus: CanonicalChargeStatus,
  providerChargeId: string | undefined
): Promise<void> {
  if (!providerChargeId?.trim()) {
    return;
  }
  await client.query(
    `UPDATE payment_transactions
     SET status = $2, updated_at = now()
     WHERE charge_id = $1::uuid
       AND gateway_transaction_id = $3`,
    [chargeId, canonicalStatus, providerChargeId]
  );
}

async function recordStatusChange(
  client: PoolClient,
  tenantId: string,
  charge: ChargeRow,
  eventType: string,
  newStatus: CanonicalChargeStatus,
  payload: Record<string, unknown>
): Promise<void> {
  await insertChargeEvent(client, {
    tenantId,
    chargeId: charge.id,
    eventType,
    oldStatus: charge.canonical_status,
    newStatus,
    payload
  });

  await writeAuditLog(
    {
      tenantId,
      action: "status_change",
      resourceType: "charge",
      resourceId: charge.id,
      oldValue: { canonical_status: charge.canonical_status },
      newValue: { canonical_status: newStatus }
    },
    client
  );
}

function eventPayload(ctx: AsaasWebhookContext): Record<string, unknown> {
  return {
    asaas_event: ctx.event,
    valor_pago: ctx.valorPago ?? null,
    data_pagamento: ctx.dataPagamento ?? null,
    provider_charge_id: ctx.instruction.providerChargeId ?? null,
    reference: ctx.instruction.reference ?? null
  };
}

async function applyPaymentConfirmed(
  client: PoolClient,
  tenantId: string,
  ctx: AsaasWebhookContext,
  charge: ChargeRow
): Promise<ApplyAsaasWebhookResult> {
  const sideEffect: WebhookSideEffectPlan = {
    kind: "payment_confirmed",
    chargeId: charge.id,
    tenantId
  };

  if (charge.canonical_status === "paga" || charge.canonical_status === "cancelada") {
    return { outcome: "noop", sideEffect };
  }

  const upd = await client.query(
    `UPDATE charges
     SET canonical_status = 'paga',
         paid_at = now(),
         updated_at = now()
     WHERE id = $1::uuid
       AND tenant_id = current_setting('app.tenant_id', true)::uuid
       AND canonical_status NOT IN ('paga', 'cancelada')
     RETURNING id::text`,
    [charge.id]
  );

  if ((upd.rowCount ?? 0) === 0) {
    return { outcome: "noop", sideEffect };
  }

  await recordStatusChange(client, tenantId, charge, "webhook_payment_confirmed", "paga", eventPayload(ctx));
  await syncPaymentTransaction(client, charge.id, "paga", ctx.instruction.providerChargeId);

  return { outcome: "applied", sideEffect };
}

async function applyPaymentOverdue(
  client: PoolClient,
  tenantId: string,
  ctx: AsaasWebhookContext,
  charge: ChargeRow
): Promise<ApplyAsaasWebhookResult> {
  const sideEffect: WebhookSideEffectPlan = {
    kind: "payment_overdue",
    chargeId: charge.id,
    tenantId
  };

  if (charge.canonical_status === "paga" || charge.canonical_status === "cancelada") {
    return { outcome: "noop", sideEffect };
  }

  const decision = evaluateChargeStatusTransition(charge.canonical_status, "vencida");
  if (decision !== "allow") {
    return {
      outcome: "illegal_transition",
      from: charge.canonical_status,
      to: "vencida"
    };
  }

  await client.query(
    `UPDATE charges
     SET canonical_status = 'vencida', updated_at = now()
     WHERE id = $1::uuid
       AND tenant_id = current_setting('app.tenant_id', true)::uuid`,
    [charge.id]
  );

  await recordStatusChange(client, tenantId, charge, "webhook_payment_overdue", "vencida", eventPayload(ctx));
  await syncPaymentTransaction(client, charge.id, "vencida", ctx.instruction.providerChargeId);

  return { outcome: "applied", sideEffect };
}

async function applyPaymentCancelled(
  client: PoolClient,
  tenantId: string,
  ctx: AsaasWebhookContext,
  charge: ChargeRow
): Promise<ApplyAsaasWebhookResult> {
  const sideEffect: WebhookSideEffectPlan = {
    kind: "payment_cancelled",
    chargeId: charge.id,
    tenantId
  };

  if (charge.canonical_status === "paga" || charge.canonical_status === "cancelada") {
    return { outcome: "noop", sideEffect };
  }

  const upd = await client.query(
    `UPDATE charges
     SET canonical_status = 'cancelada',
         cancelled_at = now(),
         updated_at = now()
     WHERE id = $1::uuid
       AND tenant_id = current_setting('app.tenant_id', true)::uuid
       AND canonical_status NOT IN ('paga', 'cancelada')
     RETURNING id::text`,
    [charge.id]
  );

  if ((upd.rowCount ?? 0) === 0) {
    return { outcome: "noop", sideEffect };
  }

  await recordStatusChange(
    client,
    tenantId,
    charge,
    "webhook_payment_cancelled",
    "cancelada",
    eventPayload(ctx)
  );
  await syncPaymentTransaction(client, charge.id, "cancelada", ctx.instruction.providerChargeId);

  return { outcome: "applied", sideEffect };
}

async function applyPaymentRestored(
  client: PoolClient,
  tenantId: string,
  ctx: AsaasWebhookContext,
  charge: ChargeRow
): Promise<ApplyAsaasWebhookResult> {
  const sideEffect: WebhookSideEffectPlan = { kind: "none" };

  if (charge.canonical_status !== "cancelada") {
    return { outcome: "noop", sideEffect };
  }

  const upd = await client.query(
    `UPDATE charges
     SET canonical_status = 'emitida',
         cancelled_at = NULL,
         updated_at = now()
     WHERE id = $1::uuid
       AND tenant_id = current_setting('app.tenant_id', true)::uuid
       AND canonical_status = 'cancelada'
     RETURNING id::text`,
    [charge.id]
  );

  if ((upd.rowCount ?? 0) === 0) {
    return { outcome: "noop", sideEffect };
  }

  await recordStatusChange(client, tenantId, charge, "webhook_payment_restored", "emitida", eventPayload(ctx));
  await syncPaymentTransaction(client, charge.id, "emitida", ctx.instruction.providerChargeId);

  return { outcome: "applied", sideEffect };
}

async function applyGenericAsaasTransition(
  client: PoolClient,
  tenantId: string,
  ctx: AsaasWebhookContext,
  charge: ChargeRow
): Promise<ApplyAsaasWebhookResult> {
  const to = ctx.instruction.canonicalStatus;
  const sideEffect: WebhookSideEffectPlan = {
    kind: "generic",
    chargeId: charge.id,
    tenantId,
    newStatus: to,
    asaasEvent: ctx.event
  };

  if (charge.canonical_status === to) {
    return { outcome: "noop", sideEffect };
  }

  const decision = evaluateChargeStatusTransition(charge.canonical_status, to);
  if (decision === "deny") {
    return { outcome: "illegal_transition", from: charge.canonical_status, to };
  }
  if (decision === "noop") {
    return { outcome: "noop", sideEffect };
  }

  await client.query(
    `UPDATE charges
     SET canonical_status = $2::text,
         paid_at = CASE WHEN $2::text = 'paga' THEN now() ELSE paid_at END,
         cancelled_at = CASE WHEN $2::text = 'cancelada' THEN now() ELSE cancelled_at END,
         updated_at = now()
     WHERE id = $1::uuid
       AND tenant_id = current_setting('app.tenant_id', true)::uuid`,
    [charge.id, to]
  );

  await recordStatusChange(client, tenantId, charge, "webhook_asaas", to, eventPayload(ctx));
  await syncPaymentTransaction(client, charge.id, to, ctx.instruction.providerChargeId);

  return { outcome: "applied", sideEffect };
}

/**
 * Aplica evento Asaas mapeado em ASAAS_TO_CANONICAL dentro da transacao pg do inbox.
 */
export async function applyAsaasWebhookEvent(
  client: PoolClient,
  tenantId: string,
  ctx: AsaasWebhookContext
): Promise<ApplyAsaasWebhookResult> {
  const charge = await findCharge(client, ctx.instruction);
  if (!charge) {
    return { outcome: "not_found" };
  }

  switch (ctx.event) {
    case "PAYMENT_CONFIRMED":
    case "PAYMENT_RECEIVED":
      return applyPaymentConfirmed(client, tenantId, ctx, charge);
    case "PAYMENT_OVERDUE":
      return applyPaymentOverdue(client, tenantId, ctx, charge);
    case "PAYMENT_DELETED":
    case "PAYMENT_REFUNDED":
      return applyPaymentCancelled(client, tenantId, ctx, charge);
    case "PAYMENT_RESTORED":
      return applyPaymentRestored(client, tenantId, ctx, charge);
    default:
      return applyGenericAsaasTransition(client, tenantId, ctx, charge);
  }
}
