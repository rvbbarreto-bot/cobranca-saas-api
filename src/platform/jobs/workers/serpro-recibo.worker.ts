import { Worker, type Job } from "bullmq";
import { isFiscalGuiasEnabled } from "../../config/fiscal-guias-enabled";
import { redisConnection } from "../redis-connection";
import { QUEUE_SERPRO_RECIBO } from "../queues";
import {
  processSerproReciboJob,
  type SerproReciboJobPayload
} from "../../../modules/fiscal-processamento/application/process-serpro-recibo-job";
import { attachWorkerDlqHandler } from "../dlq/handle-job-final-failure";

async function onJob(job: Job<SerproReciboJobPayload>): Promise<void> {
  await processSerproReciboJob(job.data);
}

export function registerSerproReciboWorker(): Worker<SerproReciboJobPayload> | null {
  if (!isFiscalGuiasEnabled()) return null;
  const worker = new Worker<SerproReciboJobPayload>(QUEUE_SERPRO_RECIBO, onJob, {
    connection: redisConnection,
    concurrency: Number(process.env.SERPRO_RECIBO_CONCURRENCY || 2)
  });
  attachWorkerDlqHandler(worker, QUEUE_SERPRO_RECIBO);
  return worker;
}
