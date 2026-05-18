import type { Worker } from "bullmq";
import { registerRepeatableJobs } from "./register-repeatable-jobs";
import { createPaymentEmissionWorker } from "./workers/payment-emission.worker";
import { createWebhookProcessWorker } from "./workers/webhook-process.worker";
import { registerChargeSyncWorker } from "./workers/charge-status-sync.worker";
import { registerNotificationSendWorker } from "./workers/notification-send.worker";

const activeWorkers: Worker[] = [];

/**
 * Inicia workers BullMQ no mesmo processo da API.
 * Redis offline: log de aviso; nao derruba o processo HTTP.
 */
export function startAllWorkers(): void {
  try {
    activeWorkers.push(
      createPaymentEmissionWorker(),
      createWebhookProcessWorker(),
      registerChargeSyncWorker(),
      registerNotificationSendWorker()
    );

    void registerRepeatableJobs().catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.warn("[workers] falha ao registrar jobs recorrentes:", msg);
    });

    // eslint-disable-next-line no-console
    console.log("[workers] BullMQ ativo:", activeWorkers.length, "worker(s)");
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-console
    console.warn("[workers] nao foi possivel iniciar workers (Redis offline?):", msg);
  }
}

export async function stopAllWorkers(): Promise<void> {
  await Promise.all(activeWorkers.map((w) => w.close()));
  activeWorkers.length = 0;
}
