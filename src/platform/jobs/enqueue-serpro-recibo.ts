import { isFiscalGuiasEnabled } from "../config/fiscal-guias-enabled";
import { isFiscalSerproEnabled } from "../config/fiscal-serpro-enabled";
import { isJobsEnabled } from "./redis-connection";
import { getQueues, QUEUE_SERPRO_RECIBO } from "./queues";
import {
  processSerproReciboJob,
  type SerproReciboJobPayload
} from "../../modules/fiscal-processamento/application/process-serpro-recibo-job";

const jobOpts = {
  attempts: 3,
  backoff: { type: "fixed" as const, delay: 10_000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 50 }
};

export async function enqueueSerproReciboJob(payload: SerproReciboJobPayload): Promise<void> {
  if (!isFiscalGuiasEnabled() || !isFiscalSerproEnabled()) return;
  if (!isJobsEnabled()) {
    await processSerproReciboJob(payload);
    return;
  }
  await getQueues().serproRecibo.add("recibo", payload, jobOpts);
}

export function scheduleSerproReciboJob(payload: SerproReciboJobPayload): void {
  setImmediate(() => {
    void enqueueSerproReciboJob(payload).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      // eslint-disable-next-line no-console
      console.error("[enqueue-serpro-recibo] falha:", message);
    });
  });
}

export { QUEUE_SERPRO_RECIBO };
