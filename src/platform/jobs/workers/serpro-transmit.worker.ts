import { Worker, type Job } from "bullmq";
import { isFiscalGuiasEnabled } from "../../config/fiscal-guias-enabled";
import { redisConnection } from "../redis-connection";
import { QUEUE_SERPRO_TRANSMIT } from "../queues";
import {
  processSerproTransmitJob,
  type SerproTransmitJobPayload
} from "../../../modules/fiscal-processamento/application/process-serpro-transmit-job";
import { attachWorkerDlqHandler } from "../dlq/handle-job-final-failure";

async function onJob(job: Job<SerproTransmitJobPayload>): Promise<void> {
  await processSerproTransmitJob(job.data);
}

export function registerSerproTransmitWorker(): Worker<SerproTransmitJobPayload> | null {
  if (!isFiscalGuiasEnabled()) return null;
  const worker = new Worker<SerproTransmitJobPayload>(QUEUE_SERPRO_TRANSMIT, onJob, {
    connection: redisConnection,
    concurrency: Number(process.env.SERPRO_TRANSMIT_CONCURRENCY || 2)
  });
  attachWorkerDlqHandler(worker, QUEUE_SERPRO_TRANSMIT);
  return worker;
}
