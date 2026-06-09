import { Worker, type Job } from "bullmq";
import { isFiscalGuiasEnabled } from "../../config/fiscal-guias-enabled";
import { redisConnection } from "../redis-connection";
import { QUEUE_FISCAL_INGEST_VALIDATE } from "../queues";
import {
  processFiscalIngestValidateJob,
  type FiscalIngestValidateJobPayload
} from "../../../modules/fiscal-ingestion/application/process-fiscal-ingest-validate";
import { attachWorkerDlqHandler } from "../dlq/handle-job-final-failure";

async function onJob(job: Job<FiscalIngestValidateJobPayload>): Promise<void> {
  await processFiscalIngestValidateJob(job.data);
}

export function registerFiscalIngestValidateWorker(): Worker<FiscalIngestValidateJobPayload> | null {
  if (!isFiscalGuiasEnabled()) {
    return null;
  }

  const worker = new Worker<FiscalIngestValidateJobPayload>(QUEUE_FISCAL_INGEST_VALIDATE, onJob, {
    connection: redisConnection,
    concurrency: Number(process.env.FISCAL_INGEST_CONCURRENCY || 2)
  });
  attachWorkerDlqHandler(worker, QUEUE_FISCAL_INGEST_VALIDATE);
  return worker;
}
