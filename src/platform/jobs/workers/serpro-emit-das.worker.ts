import { Worker, type Job } from "bullmq";
import { isFiscalGuiasEnabled } from "../../config/fiscal-guias-enabled";
import { redisConnection } from "../redis-connection";
import { QUEUE_SERPRO_EMIT_DAS } from "../queues";
import {
  processSerproEmitDasJob,
  type SerproEmitDasJobPayload
} from "../../../modules/fiscal-processamento/application/process-serpro-emit-das-job";
import { attachWorkerDlqHandler } from "../dlq/handle-job-final-failure";

async function onJob(job: Job<SerproEmitDasJobPayload>): Promise<void> {
  await processSerproEmitDasJob(job.data);
}

export function registerSerproEmitDasWorker(): Worker<SerproEmitDasJobPayload> | null {
  if (!isFiscalGuiasEnabled()) return null;
  const worker = new Worker<SerproEmitDasJobPayload>(QUEUE_SERPRO_EMIT_DAS, onJob, {
    connection: redisConnection,
    concurrency: Number(process.env.SERPRO_EMIT_DAS_CONCURRENCY || 2)
  });
  attachWorkerDlqHandler(worker, QUEUE_SERPRO_EMIT_DAS);
  return worker;
}
