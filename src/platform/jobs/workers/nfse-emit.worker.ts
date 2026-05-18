import { Worker, type Job } from "bullmq";
import { redisConnection } from "../redis-connection";
import { QUEUE_NFSE_EMIT } from "../queues";
import {
  processNfseEmit,
  type NfseEmitJobData
} from "../application/nfse-emit-processor";

async function onJob(job: Job<NfseEmitJobData>): Promise<void> {
  const { chargeId, tenantId } = job.data;
  if (!chargeId?.trim() || !tenantId?.trim()) {
    throw new Error("Job nfse:emit exige chargeId e tenantId.");
  }
  await processNfseEmit({ chargeId: chargeId.trim(), tenantId: tenantId.trim() });
}

export function registerNfseEmitWorker(): Worker<NfseEmitJobData> {
  return new Worker<NfseEmitJobData>(QUEUE_NFSE_EMIT, onJob, {
    connection: redisConnection,
    concurrency: Number(process.env.NFSE_EMIT_CONCURRENCY || 2)
  });
}
