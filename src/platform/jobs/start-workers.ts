import type { Worker } from "bullmq";
import { isFiscalGuiasEnabled } from "../config/fiscal-guias-enabled";
import { registerRepeatableJobs } from "./register-repeatable-jobs";
import { createPaymentEmissionWorker } from "./workers/payment-emission.worker";
import { createWebhookProcessWorker } from "./workers/webhook-process.worker";
import { registerChargeSyncWorker } from "./workers/charge-status-sync.worker";
import { registerNotificationSendWorker } from "./workers/notification-send.worker";
import { registerFiscalCaptureWorker } from "./workers/fiscal-capture.worker";
import { registerFiscalIngestValidateWorker } from "./workers/fiscal-ingest-validate.worker";
import { registerSerproTransmitWorker } from "./workers/serpro-transmit.worker";
import { registerSerproReciboWorker } from "./workers/serpro-recibo.worker";
import { registerSerproEmitDasWorker } from "./workers/serpro-emit-das.worker";
import { registerCertificateExpiryWorker } from "./workers/certificate-expiry.worker";

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

    if (isFiscalGuiasEnabled()) {
      const fiscalWorker = registerFiscalCaptureWorker();
      if (fiscalWorker) {
        activeWorkers.push(fiscalWorker);
      }
      const ingestWorker = registerFiscalIngestValidateWorker();
      if (ingestWorker) {
        activeWorkers.push(ingestWorker);
      }
      const serproWorker = registerSerproTransmitWorker();
      if (serproWorker) {
        activeWorkers.push(serproWorker);
      }
      const reciboWorker = registerSerproReciboWorker();
      if (reciboWorker) {
        activeWorkers.push(reciboWorker);
      }
      const emitDasWorker = registerSerproEmitDasWorker();
      if (emitDasWorker) {
        activeWorkers.push(emitDasWorker);
      }
      const certExpiryWorker = registerCertificateExpiryWorker();
      if (certExpiryWorker) {
        activeWorkers.push(certExpiryWorker);
      }
    }

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
