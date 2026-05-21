import { Worker, type Job } from "bullmq";
import { isJobsEnabled, redisConnection } from "../redis-connection";
import { getQueues, JOB_OPTS, QUEUE_CHARGE_SYNC } from "../queues";
import { processChargeStatusSync, processDailyChargingRegua } from "../application/charge-status-sync-processor";
import { enqueueReguaNotificationJob, reguaJobId } from "../enqueue-notification";

type SyncJobData = Record<string, never>;

async function onJob(job: Job<SyncJobData>): Promise<void> {
  if (job.name === "daily-regua") {
    await processDailyChargingRegua(async (payload) => {
      await enqueueReguaNotificationJob(
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

async function registerChargeSyncRepeatableJob(): Promise<void> {
  if (!isJobsEnabled()) {
    return;
  }
  await getQueues().chargeSync.add(
    "sync-job",
    {},
    {
      ...JOB_OPTS.sync,
      repeat: { pattern: "*/15 * * * *" },
      jobId: "charge-sync-recurring"
    }
  );
}

/**
 * Worker de reconciliação com o gateway (failsafe 24h) + job recorrente a cada 15 min.
 */
export function registerChargeSyncWorker(): Worker<SyncJobData> {
  const worker = new Worker<SyncJobData>(QUEUE_CHARGE_SYNC, onJob, {
    connection: redisConnection,
    concurrency: 1
  });

  void registerChargeSyncRepeatableJob().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-console
    console.warn("[charge-status-sync] falha ao registrar job recorrente:", message);
  });

  return worker;
}

/** @deprecated use registerChargeSyncWorker */
export function createChargeStatusSyncWorker(): Worker<SyncJobData> {
  return registerChargeSyncWorker();
}
