import { Queue } from "bullmq";
import type { Job } from "bullmq";
import { redisConnection } from "../redis-connection";
import { getQueues, QUEUE_CHARGE_SYNC, QUEUE_NOTIFICATION_SEND, QUEUE_PAYMENT_EMISSION, QUEUE_WEBHOOK_PROCESS } from "../queues";
import type { DlqJobPayload } from "./dlq-types";
import { dlqQueueName } from "./dlq-types";

const dlqCache = new Map<string, Queue<DlqJobPayload>>();

function getDlqQueue(originalQueue: string): Queue<DlqJobPayload> {
  const name = dlqQueueName(originalQueue);
  let q = dlqCache.get(name);
  if (!q) {
    q = new Queue<DlqJobPayload>(name, { connection: redisConnection });
    dlqCache.set(name, q);
  }
  return q;
}

export const MONITORED_QUEUES = [
  QUEUE_PAYMENT_EMISSION,
  QUEUE_WEBHOOK_PROCESS,
  QUEUE_NOTIFICATION_SEND,
  QUEUE_CHARGE_SYNC
] as const;

export type MonitoredQueueName = (typeof MONITORED_QUEUES)[number];

function resolvePrimaryQueue(originalQueue: string) {
  const queues = getQueues();
  switch (originalQueue) {
    case QUEUE_PAYMENT_EMISSION:
      return queues.paymentEmission;
    case QUEUE_WEBHOOK_PROCESS:
      return queues.webhookProcess;
    case QUEUE_NOTIFICATION_SEND:
      return queues.notificationSend;
    case QUEUE_CHARGE_SYNC:
      return queues.chargeSync;
    default:
      throw new Error(`Fila desconhecida para reprocessamento: ${originalQueue}`);
  }
}

export async function enqueueDlq(payload: DlqJobPayload): Promise<string> {
  const q = getDlqQueue(payload.originalQueue);
  const job = await q.add("dlq", payload, {
    removeOnComplete: { count: 500 },
    removeOnFail: false
  });
  return String(job.id);
}

export async function getFailedJobs(originalQueue: string, limit: number): Promise<DlqJobPayload[]> {
  const q = getDlqQueue(originalQueue);
  const jobs = await q.getJobs(["waiting", "delayed", "failed", "completed"], 0, Math.max(limit - 1, 0));
  return jobs
    .map((j) => j.data as DlqJobPayload)
    .filter((d) => d && typeof d.originalQueue === "string");
}

export async function reprocessDlqJob(originalQueue: string, dlqJobId: string): Promise<string> {
  const dlq = getDlqQueue(originalQueue);
  const dlqJob = await dlq.getJob(dlqJobId);
  if (!dlqJob?.data) {
    throw new Error(`Job DLQ ${dlqJobId} nao encontrado em ${dlqQueueName(originalQueue)}.`);
  }

  const data = dlqJob.data as DlqJobPayload;
  const primary = resolvePrimaryQueue(originalQueue);
  const newJob = await primary.add("reprocess-from-dlq", data.payload as object, {
    jobId: undefined
  });
  await dlqJob.remove();
  return String(newJob.id);
}

export async function getPrimaryQueueCounts(
  queueName: MonitoredQueueName
): Promise<Record<string, number>> {
  const q = resolvePrimaryQueue(queueName);
  const counts = await q.getJobCounts(
    "waiting",
    "active",
    "completed",
    "failed",
    "delayed",
    "paused"
  );
  return counts as Record<string, number>;
}

export async function getDlqQueueCounts(
  originalQueue: MonitoredQueueName
): Promise<Record<string, number>> {
  const q = getDlqQueue(originalQueue);
  const counts = await q.getJobCounts(
    "waiting",
    "active",
    "completed",
    "failed",
    "delayed",
    "paused"
  );
  return counts as Record<string, number>;
}

export function buildDlqPayloadFromJob<T>(
  job: Job<T>,
  originalQueue: string,
  classification: { errorCode: string; errorMessage: string; retryable: boolean }
): DlqJobPayload {
  const data = job.data as Record<string, unknown>;
  return {
    originalQueue,
    originalJobId: String(job.id),
    tenantId: String(data.tenantId ?? ""),
    chargeId: data.chargeId ? String(data.chargeId) : undefined,
    inboxId: data.inboxId ? String(data.inboxId) : undefined,
    attemptsMade: job.attemptsMade,
    failedAt: new Date().toISOString(),
    errorCode: classification.errorCode,
    errorMessage: classification.errorMessage,
    retryable: classification.retryable,
    correlationId:
      typeof data.correlationId === "string" ? data.correlationId : process.env.CORRELATION_ID,
    payload: job.data
  };
}
