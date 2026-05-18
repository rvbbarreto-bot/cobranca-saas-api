import { isJobsEnabled } from "./redis-connection";
import { JOB_OPTS, queues } from "./queues";

/** Registra crons idempotentes (charge sync 15min + regua diaria 07h). */
export async function registerRepeatableJobs(): Promise<void> {
  if (!isJobsEnabled()) {
    return;
  }
  await queues.chargeSync.add("sync-stale", {}, { ...JOB_OPTS.sync, repeat: { pattern: "*/15 * * * *" } });
  await queues.chargeSync.add("daily-regua", {}, { ...JOB_OPTS.sync, repeat: { pattern: "0 7 * * *" } });
}
