import { Worker, type Job } from "bullmq";
import { isFiscalGuiasEnabled } from "../../config/fiscal-guias-enabled";
import { redisConnection } from "../redis-connection";
import { QUEUE_FISCAL_CAPTURE } from "../queues";
import {
  processFiscalCaptureJob,
  type FiscalCaptureJobPayload
} from "../application/fiscal-capture-processor";
import { attachWorkerDlqHandler } from "../dlq/handle-job-final-failure";

async function onJob(job: Job<FiscalCaptureJobPayload>): Promise<void> {
  await processFiscalCaptureJob(job.data);
}

/**
 * Worker BullMQ da fila fiscal-capture (captura DAS/DARF).
 * Só deve ser registrado quando FISCAL_GUIAS_ENABLED=true.
 */
export function registerFiscalCaptureWorker(): Worker<FiscalCaptureJobPayload> | null {
  if (!isFiscalGuiasEnabled()) {
    return null;
  }

  const worker = new Worker<FiscalCaptureJobPayload>(QUEUE_FISCAL_CAPTURE, onJob, {
    connection: redisConnection,
    concurrency: Number(process.env.FISCAL_CAPTURE_CONCURRENCY || 2)
  });
  attachWorkerDlqHandler(worker, QUEUE_FISCAL_CAPTURE);
  return worker;
}

/** Processo dedicado: node dist/platform/jobs/workers/fiscal-capture.worker.js */
if (require.main === module) {
  if (!isFiscalGuiasEnabled()) {
    // eslint-disable-next-line no-console
    console.warn("[fiscal-capture.worker] FISCAL_GUIAS_ENABLED=false — encerrando.");
    process.exit(0);
  }

  const worker = registerFiscalCaptureWorker();
  if (!worker) {
    process.exit(1);
  }

  worker.on("ready", () => {
    // eslint-disable-next-line no-console
    console.log("[fiscal-capture.worker] consumindo fila", QUEUE_FISCAL_CAPTURE);
  });

  const shutdown = async () => {
    await worker.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}
