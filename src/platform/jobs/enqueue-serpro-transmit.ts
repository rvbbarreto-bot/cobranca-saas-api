import { isFiscalGuiasEnabled } from "../config/fiscal-guias-enabled";
import { isJobsEnabled } from "./redis-connection";
import { getQueues, QUEUE_SERPRO_TRANSMIT } from "./queues";
import {
  processSerproTransmitJob,
  type SerproTransmitJobPayload
} from "../../modules/fiscal-processamento/application/process-serpro-transmit-job";

const jobOpts = {
  attempts: 3,
  backoff: { type: "fixed" as const, delay: 10_000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 50 }
};

export async function enqueueSerproTransmitJob(payload: SerproTransmitJobPayload): Promise<void> {
  if (!isFiscalGuiasEnabled()) return;
  if (!isJobsEnabled()) {
    await processSerproTransmitJob(payload);
    return;
  }
  await getQueues().serproTransmit.add("transmit", payload, jobOpts);
}

export function scheduleSerproTransmitJob(payload: SerproTransmitJobPayload): void {
  setImmediate(() => {
    void enqueueSerproTransmitJob(payload).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      // eslint-disable-next-line no-console
      console.error("[enqueue-serpro-transmit] falha:", message);
    });
  });
}

export { QUEUE_SERPRO_TRANSMIT };
