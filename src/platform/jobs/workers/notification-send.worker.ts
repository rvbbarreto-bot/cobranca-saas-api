import { Worker, type Job } from "bullmq";
import { redisConnection } from "../redis-connection";
import { QUEUE_NOTIFICATION_SEND } from "../queues";
import { processNotificationSend } from "../application/notification-send-processor";
import type { NotificationSendJobPayload } from "../enqueue-notification";

async function onJob(job: Job<NotificationSendJobPayload>): Promise<void> {
  const { chargeId, tenantId, eventType } = job.data;
  if (!chargeId?.trim() || !tenantId?.trim() || !eventType?.trim()) {
    throw new Error("Job notifications-send exige chargeId, tenantId e eventType.");
  }
  await processNotificationSend(job.data);
}

export function createNotificationSendWorker(): Worker<NotificationSendJobPayload> {
  return new Worker<NotificationSendJobPayload>(QUEUE_NOTIFICATION_SEND, onJob, {
    connection: redisConnection,
    concurrency: Number(process.env.NOTIFICATION_SEND_CONCURRENCY || 5)
  });
}

