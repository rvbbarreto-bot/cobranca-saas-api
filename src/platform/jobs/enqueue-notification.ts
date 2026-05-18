import { isJobsEnabled } from "./redis-connection";
import { getQueues, JOB_OPTS } from "./queues";

export type NotificationSendJobPayload = {
  chargeId: string;
  tenantId: string;
  eventType: string;
  daysOffset?: number;
  forceChannel?: "email" | "whatsapp" | "both";
};

export function reguaJobId(chargeId: string, daysOffset: number): string {
  return `regua-${chargeId}-${daysOffset}`;
}

export async function enqueueNotificationJob(
  payload: NotificationSendJobPayload,
  options?: { jobId?: string; delay?: number }
): Promise<void> {
  if (!isJobsEnabled()) {
    return;
  }
  await getQueues().notificationSend.add("send", payload, {
    ...JOB_OPTS.notification,
    jobId: options?.jobId,
    delay: options?.delay
  });
}

export async function cancelReguaJobsForCharge(chargeId: string): Promise<void> {
  if (!isJobsEnabled()) {
    return;
  }
  const offsets = [-3, -1, 0, 3, 7];
  for (const offset of offsets) {
    const job = await getQueues().notificationSend.getJob(reguaJobId(chargeId, offset));
    if (job) {
      await job.remove();
    }
  }
}
