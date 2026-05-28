import { Worker, type Job } from "bullmq";
import { redisConnection } from "../redis-connection";
import { QUEUE_WEBHOOK_PROCESS } from "../queues";
import { processPendingWebhooksForTenant } from "../../../modules/inbox/application/process-webhook-inbox";
import type { WebhookProcessJobPayload } from "../enqueue-webhook-process";
import { attachWorkerDlqHandler } from "../dlq/handle-job-final-failure";

async function onJob(job: Job<WebhookProcessJobPayload>): Promise<void> {
  const tenantId = job.data.tenantId?.trim();
  if (!tenantId) {
    throw new Error("Job inbox-process exige tenantId.");
  }
  const limit = Math.min(job.data.limit ?? 25, 100);
  await processPendingWebhooksForTenant(tenantId, limit);
}

export function createWebhookProcessWorker(): Worker<WebhookProcessJobPayload> {
  const worker = new Worker<WebhookProcessJobPayload>(QUEUE_WEBHOOK_PROCESS, onJob, {
    connection: redisConnection,
    concurrency: Number(process.env.WEBHOOK_PROCESS_CONCURRENCY || 3)
  });
  attachWorkerDlqHandler(worker, QUEUE_WEBHOOK_PROCESS);
  return worker;
}

