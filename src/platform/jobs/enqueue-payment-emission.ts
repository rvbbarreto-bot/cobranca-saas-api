import { isJobsEnabled } from "./redis-connection";
import { getQueues, JOB_OPTS } from "./queues";

export type PaymentEmissionJobPayload = {
  chargeId: string;
  tenantId: string;
};

/** Enfileira emissao assincrona no gateway (nao aguarda o worker). */
export async function enqueuePaymentEmissionJob(charge: {
  id: string;
  tenantId: string;
}): Promise<void> {
  if (!isJobsEnabled()) {
    return;
  }
  await getQueues().paymentEmission.add(
    "emit-charge",
    { chargeId: charge.id, tenantId: charge.tenantId },
    JOB_OPTS.emission
  );
}

/**
 * Agenda enfileiramento apos o commit da transacao que criou a cobranca.
 * Evita corrida em que o worker le a charge antes do COMMIT.
 */
export function schedulePaymentEmissionJob(charge: { id: string; tenantId: string }): void {
  setImmediate(() => {
    void enqueuePaymentEmissionJob(charge).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      // eslint-disable-next-line no-console
      console.error("[enqueue-payment-emission] falha ao enfileirar:", message);
    });
  });
}
