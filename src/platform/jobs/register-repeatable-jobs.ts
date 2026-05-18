import { isJobsEnabled } from "./redis-connection";
import { getQueues, JOB_OPTS } from "./queues";

/** Registra crons idempotentes (charge sync 15min + regua diaria 07h). */
export async function registerRepeatableJobs(): Promise<void> {
  if (!isJobsEnabled()) {
    return;
  }
  const q = getQueues();
  await q.chargeSync.add("sync-stale", {}, { ...JOB_OPTS.sync, repeat: { pattern: "*/15 * * * *" } });
  await q.chargeSync.add("daily-regua", {}, { ...JOB_OPTS.sync, repeat: { pattern: "0 7 * * *" } });
}
