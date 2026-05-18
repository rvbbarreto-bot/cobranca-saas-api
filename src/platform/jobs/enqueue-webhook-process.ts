import { isJobsEnabled } from "./redis-connection";
import { JOB_OPTS, queues } from "./queues";

export type WebhookProcessJobPayload = {
  tenantId: string;
  limit?: number;
};

const webhookJobOpts = {
  ...JOB_OPTS.sync,
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 10_000 },
  removeOnComplete: { count: 200 },
  removeOnFail: { count: 100 }
};

export async function enqueueWebhookProcessJob(payload: WebhookProcessJobPayload): Promise<void> {
  if (!isJobsEnabled()) {
    return;
  }
  await queues.webhookProcess.add(
    "process-pending",
    { tenantId: payload.tenantId, limit: payload.limit ?? 25 },
    webhookJobOpts
  );
}

export function scheduleWebhookProcessJob(payload: WebhookProcessJobPayload): void {
  setImmediate(() => {
    void enqueueWebhookProcessJob(payload).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      // eslint-disable-next-line no-console
      console.error("[enqueue-webhook-process] falha ao enfileirar:", message);
    });
  });
}
