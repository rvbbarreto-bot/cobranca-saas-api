import { isFiscalGuiasEnabled } from "../config/fiscal-guias-enabled";
import { isJobsEnabled } from "./redis-connection";
import { getQueues, QUEUE_FISCAL_INGEST_VALIDATE } from "./queues";
import {
  processFiscalIngestValidateJob,
  type FiscalIngestValidateJobPayload
} from "../../modules/fiscal-ingestion/application/process-fiscal-ingest-validate";

const ingestValidateJobOpts = {
  attempts: 3,
  backoff: { type: "fixed" as const, delay: 5_000 },
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 50 }
};

export async function enqueueFiscalIngestValidateJob(
  payload: FiscalIngestValidateJobPayload
): Promise<void> {
  if (!isFiscalGuiasEnabled()) {
    return;
  }
  if (!isJobsEnabled()) {
    await processFiscalIngestValidateJob(payload);
    return;
  }
  await getQueues().fiscalIngestValidate.add("validate", payload, ingestValidateJobOpts);
}

export function scheduleFiscalIngestValidateJob(payload: FiscalIngestValidateJobPayload): void {
  setImmediate(() => {
    void enqueueFiscalIngestValidateJob(payload).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      // eslint-disable-next-line no-console
      console.error("[enqueue-fiscal-ingest-validate] falha:", message);
    });
  });
}

export { QUEUE_FISCAL_INGEST_VALIDATE };
