import { isFiscalGuiasEnabled } from "../config/fiscal-guias-enabled";
import { isJobsEnabled } from "./redis-connection";
import { getQueues, JOB_OPTS, QUEUE_FISCAL_CAPTURE } from "./queues";
import type { FiscalCaptureJobPayload } from "./application/fiscal-capture-processor";

const fiscalCaptureJobOpts = {
  attempts: 5,
  backoff: { type: "exponential" as const, delay: 30_000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 50 }
};

export async function enqueueFiscalCaptureJob(payload: FiscalCaptureJobPayload): Promise<void> {
  if (!isFiscalGuiasEnabled() || !isJobsEnabled()) {
    return;
  }
  await getQueues().fiscalCapture.add("capture", payload, fiscalCaptureJobOpts);
}

export function scheduleFiscalCaptureJob(payload: FiscalCaptureJobPayload): void {
  setImmediate(() => {
    void enqueueFiscalCaptureJob(payload).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      // eslint-disable-next-line no-console
      console.error("[enqueue-fiscal-capture] falha ao enfileirar:", message);
    });
  });
}

export { QUEUE_FISCAL_CAPTURE };
