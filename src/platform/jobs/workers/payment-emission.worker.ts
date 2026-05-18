import { Worker, type Job } from "bullmq";
import { redisConnection } from "../redis-connection";
import { JOB_OPTS, QUEUE_PAYMENT_EMISSION } from "../queues";
import {
  handlePaymentEmissionFailure,
  processPaymentEmission,
  type PaymentEmissionJobData
} from "../application/payment-emission-processor";

async function onJob(job: Job<PaymentEmissionJobData>): Promise<void> {
  const { chargeId, tenantId } = job.data;
  if (!chargeId?.trim() || !tenantId?.trim()) {
    throw new Error("Job paymentEmission exige chargeId e tenantId.");
  }
  await processPaymentEmission({ chargeId: chargeId.trim(), tenantId: tenantId.trim() });
}

export function createPaymentEmissionWorker(): Worker<PaymentEmissionJobData> {
  const worker = new Worker<PaymentEmissionJobData>(QUEUE_PAYMENT_EMISSION, onJob, {
    connection: redisConnection,
    concurrency: Number(process.env.PAYMENT_EMISSION_CONCURRENCY || 2)
  });

  worker.on("failed", (job, error) => {
    if (!job) {
      return;
    }
    const maxAttempts = job.opts.attempts ?? JOB_OPTS.emission.attempts ?? 3;
    if (job.attemptsMade < maxAttempts) {
      return;
    }
    void handlePaymentEmissionFailure(job.data, error).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.error("[payment-emission.worker] falha ao registrar erro_emissao:", msg);
    });
  });

  return worker;
}

/** Processo dedicado: tsx src/platform/jobs/workers/payment-emission.worker.ts */
if (require.main === module) {
  const worker = createPaymentEmissionWorker();
  worker.on("ready", () => {
    // eslint-disable-next-line no-console
    console.log("[payment-emission.worker] consumindo fila", QUEUE_PAYMENT_EMISSION);
  });
  const shutdown = async () => {
    await worker.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}
