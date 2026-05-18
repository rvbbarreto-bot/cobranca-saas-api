import type { CanonicalChargeStatus } from "../../../modules/billing-core/domain/charge";
import {
  cancelReguaJobsForCharge,
  enqueueNotificationJob,
  reguaJobId
} from "../enqueue-notification";
import { isJobsEnabled } from "../redis-connection";
import { JOB_OPTS, queues } from "../queues";

export type WebhookSideEffectInput = {
  tenantId: string;
  chargeId: string;
  newStatus: CanonicalChargeStatus;
  asaasEvent?: string;
};

/** Efeitos assincronos apos transicao de status via webhook (fora da transacao pg). */
export async function applyWebhookSideEffects(input: WebhookSideEffectInput): Promise<void> {
  if (!isJobsEnabled()) {
    return;
  }

  const event = input.asaasEvent?.trim().toUpperCase();

  if (input.newStatus === "paga") {
    await cancelReguaJobsForCharge(input.chargeId);
    await enqueueNotificationJob({
      chargeId: input.chargeId,
      tenantId: input.tenantId,
      eventType: "pagamento_confirmado"
    });
    await queues.nfseEmit.add(
      "emit",
      { chargeId: input.chargeId, tenantId: input.tenantId },
      JOB_OPTS.nfse
    );
    return;
  }

  if (input.newStatus === "vencida" || event === "PAYMENT_OVERDUE") {
    for (const daysOffset of [3, 7]) {
      await enqueueNotificationJob(
        {
          chargeId: input.chargeId,
          tenantId: input.tenantId,
          eventType: daysOffset === 3 ? "pos_vencimento_3d" : "pos_vencimento_7d",
          daysOffset
        },
        { jobId: reguaJobId(input.chargeId, daysOffset), delay: 0 }
      );
    }
    return;
  }

  if (input.newStatus === "cancelada") {
    await cancelReguaJobsForCharge(input.chargeId);
  }
}
