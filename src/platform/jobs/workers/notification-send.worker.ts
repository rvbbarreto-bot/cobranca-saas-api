import { Worker, type Job } from "bullmq";
import { redisConnection } from "../redis-connection";
import { QUEUE_NOTIFICATION_SEND } from "../queues";
import { processNotificationSend } from "../application/notification-send-processor";
import type { NotificationSendJobPayload } from "../enqueue-notification";

async function onJob(job: Job<NotificationSendJobPayload>): Promise<void> {
  const { chargeId, tenantId, eventType } = job.data;
  if (!chargeId?.trim() || !tenantId?.trim() || !eventType?.trim()) {
    throw new Error("Job notifications:send exige chargeId, tenantId e eventType.");
  }
  await processNotificationSend(job.data);
}

/**
 * Worker BullMQ da fila notifications:send (email Resend + WhatsApp Z-API).
 */
export function registerNotificationSendWorker(): Worker<NotificationSendJobPayload> {
  return new Worker<NotificationSendJobPayload>(QUEUE_NOTIFICATION_SEND, onJob, {
    connection: redisConnection,
    concurrency: Number(process.env.NOTIFICATION_SEND_CONCURRENCY || 5)
  });
}

/** Processo dedicado: tsx src/platform/jobs/workers/notification-send.worker.ts */
if (require.main === module) {
  const worker = registerNotificationSendWorker();
  worker.on("ready", () => {
    // eslint-disable-next-line no-console
    console.log("[notification-send.worker] consumindo fila", QUEUE_NOTIFICATION_SEND);
  });
  const shutdown = async () => {
    await worker.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
}
