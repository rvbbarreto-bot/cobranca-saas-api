import { Worker, type Job } from "bullmq";
import { redisConnection } from "../redis-connection";
import { QUEUE_CHARGE_SYNC } from "../queues";
import {
  processChargeStatusSync,
  processDailyChargingRegua
} from "../application/charge-status-sync-processor";
import { enqueueNotificationJob, reguaJobId } from "../enqueue-notification";

type SyncJobData = { kind?: "sync-stale" | "daily-regua" };

async function onJob(job: Job<SyncJobData>): Promise<void> {
  const name = job.name;
  if (name === "daily-regua") {
    await processDailyChargingRegua(async (payload) => {
      await enqueueNotificationJob(
        {
          chargeId: payload.chargeId,
          tenantId: payload.tenantId,
          eventType: payload.eventType,
          daysOffset: payload.daysOffset
        },
        { jobId: reguaJobId(payload.chargeId, payload.daysOffset) }
      );
    });
    return;
  }
  await processChargeStatusSync();
}

export function createChargeStatusSyncWorker(): Worker<SyncJobData> {
  return new Worker<SyncJobData>(QUEUE_CHARGE_SYNC, onJob, {
    connection: redisConnection,
    concurrency: 1
  });
}
