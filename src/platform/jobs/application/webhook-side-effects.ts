import type { CanonicalChargeStatus } from "../../../modules/billing-core/domain/charge";
import {
  cancelReguaJobsForCharge,
  enqueuePaymentConfirmedNotification,
  enqueueReguaNotificationJob,
  reguaJobId
} from "../enqueue-notification";
import { isJobsEnabled } from "../redis-connection";

export type WebhookSideEffectPlan =
  | { kind: "payment_confirmed"; chargeId: string; tenantId: string }
  | { kind: "payment_overdue"; chargeId: string; tenantId: string }
  | { kind: "payment_cancelled"; chargeId: string; tenantId: string }
  | {
      kind: "generic";
      chargeId: string;
      tenantId: string;
      newStatus: CanonicalChargeStatus;
      asaasEvent?: string;
    }
  | { kind: "none" };

/** @deprecated use WebhookSideEffectPlan */
export type WebhookSideEffectInput = {
  tenantId: string;
  chargeId: string;
  newStatus: CanonicalChargeStatus;
  asaasEvent?: string;
};

/** Efeitos assincronos apos transicao de status via webhook (fora da transacao pg). */
export async function applyWebhookSideEffectPlan(plan: WebhookSideEffectPlan): Promise<void> {
  if (!isJobsEnabled() || plan.kind === "none") {
    return;
  }

  if (plan.kind === "payment_confirmed") {
    await cancelReguaJobsForCharge(plan.chargeId);
    await enqueuePaymentConfirmedNotification({
      chargeId: plan.chargeId,
      tenantId: plan.tenantId,
      eventType: "pagamento_confirmado"
    });
    return;
  }

  if (plan.kind === "payment_overdue") {
    for (const daysOffset of [3, 7]) {
      await enqueueReguaNotificationJob(
        {
          chargeId: plan.chargeId,
          tenantId: plan.tenantId,
          eventType: daysOffset === 3 ? "pos_vencimento_3d" : "pos_vencimento_7d",
          daysOffset
        },
        { jobId: reguaJobId(plan.chargeId, daysOffset), delay: 0 }
      );
    }
    return;
  }

  if (plan.kind === "payment_cancelled") {
    await cancelReguaJobsForCharge(plan.chargeId);
    return;
  }

  if (plan.kind === "generic") {
    await applyWebhookSideEffects({
      tenantId: plan.tenantId,
      chargeId: plan.chargeId,
      newStatus: plan.newStatus,
      asaasEvent: plan.asaasEvent
    });
  }
}

/** Compatibilidade com fluxo canonico legado. */
export async function applyWebhookSideEffects(input: WebhookSideEffectInput): Promise<void> {
  if (!isJobsEnabled()) {
    return;
  }

  const event = input.asaasEvent?.trim().toUpperCase();

  if (input.newStatus === "paga") {
    await applyWebhookSideEffectPlan({
      kind: "payment_confirmed",
      chargeId: input.chargeId,
      tenantId: input.tenantId
    });
    return;
  }

  if (input.newStatus === "vencida" || event === "PAYMENT_OVERDUE") {
    await applyWebhookSideEffectPlan({
      kind: "payment_overdue",
      chargeId: input.chargeId,
      tenantId: input.tenantId
    });
    return;
  }

  if (input.newStatus === "cancelada") {
    await applyWebhookSideEffectPlan({
      kind: "payment_cancelled",
      chargeId: input.chargeId,
      tenantId: input.tenantId
    });
  }
}
