import { isFiscalGuiasEnabled } from "../config/fiscal-guias-enabled";
import { isJobsEnabled } from "./redis-connection";
import { getQueues, JOB_OPTS } from "./queues";

/** Registra crons idempotentes (regua diaria 07h). Sync 15min: charge-status-sync.worker. */
export async function registerRepeatableJobs(): Promise<void> {
  if (!isJobsEnabled()) {
    return;
  }
  const q = getQueues();
  await q.chargeSync.add(
    "daily-regua",
    {},
    { ...JOB_OPTS.sync, repeat: { pattern: "0 7 * * *" }, jobId: "daily-regua-recurring" }
  );
  if (isFiscalGuiasEnabled()) {
    await q.certificateExpiry.add(
      "daily-cert-expiry",
      {},
      { ...JOB_OPTS.sync, repeat: { pattern: "0 6 * * *" }, jobId: "daily-cert-expiry-recurring" }
    );
  }
}
