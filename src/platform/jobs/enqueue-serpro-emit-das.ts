import { isFiscalGuiasEnabled } from "../config/fiscal-guias-enabled";
import { isFiscalSerproEnabled } from "../config/fiscal-serpro-enabled";
import { isJobsEnabled } from "./redis-connection";
import { getQueues, QUEUE_SERPRO_EMIT_DAS } from "./queues";
import {
  processSerproEmitDasJob,
  type SerproEmitDasJobPayload
} from "../../modules/fiscal-processamento/application/process-serpro-emit-das-job";

const jobOpts = {
  attempts: 3,
  backoff: { type: "fixed" as const, delay: 10_000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 50 }
};

export async function enqueueSerproEmitDasJob(payload: SerproEmitDasJobPayload): Promise<void> {
  if (!isFiscalGuiasEnabled() || !isFiscalSerproEnabled()) return;
  if (!isJobsEnabled()) {
    await processSerproEmitDasJob(payload);
    return;
  }
  await getQueues().serproEmitDas.add("emit-das", payload, jobOpts);
}

export function scheduleSerproEmitDasJob(payload: SerproEmitDasJobPayload): void {
  setImmediate(() => {
    void enqueueSerproEmitDasJob(payload).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      // eslint-disable-next-line no-console
      console.error("[enqueue-serpro-emit-das] falha:", message);
    });
  });
}

export { QUEUE_SERPRO_EMIT_DAS };
