import { isJobsEnabled } from "./redis-connection";
import { getQueues, JOB_OPTS } from "./queues";

export type NfseEmitJobPayload = {
  chargeId: string;
  tenantId: string;
};

export async function enqueueNfseEmitJob(
  payload: NfseEmitJobPayload,
  options?: { delay?: number; jobId?: string }
): Promise<void> {
  if (!isJobsEnabled()) {
    return;
  }
  await getQueues().nfseEmit.add("emit", payload, {
    ...JOB_OPTS.nfse,
    delay: options?.delay ?? 0,
    jobId: options?.jobId
  });
}
