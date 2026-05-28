import type { Job, Worker } from "bullmq";
import { classifyJobError } from "../classify-job-error";
import { logJobStructured } from "../logging/job-structured-log";
import { buildDlqPayloadFromJob, enqueueDlq } from "./dlq-service";

export async function handleJobFinalFailure<T>(
  job: Job<T>,
  originalQueue: string,
  error: unknown
): Promise<void> {
  const classification = classifyJobError(error);
  const tenantId =
    typeof job.data === "object" && job.data !== null && "tenantId" in job.data
      ? String((job.data as { tenantId?: string }).tenantId ?? "")
      : undefined;

  logJobStructured({
    level: "error",
    service: `worker:${originalQueue}`,
    message: "job_failed_permanently",
    tenantId,
    jobId: String(job.id),
    queue: originalQueue,
    correlationId:
      typeof job.data === "object" && job.data !== null && "correlationId" in job.data
        ? String((job.data as { correlationId?: string }).correlationId ?? "")
        : undefined,
    extra: {
      errorCode: classification.errorCode,
      errorMessage: classification.errorMessage,
      retryable: classification.retryable,
      attemptsMade: job.attemptsMade
    }
  });

  if (!classification.moveToDlq) {
    return;
  }

  const payload = buildDlqPayloadFromJob(job, originalQueue, classification);
  await enqueueDlq(payload);
}

export function attachWorkerDlqHandler<T>(worker: Worker<T>, originalQueue: string): void {
  worker.on("failed", (job, error) => {
    if (!job) {
      return;
    }
    const maxAttempts = job.opts.attempts ?? 1;
    if (job.attemptsMade < maxAttempts) {
      return;
    }
    void handleJobFinalFailure(job, originalQueue, error).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      logJobStructured({
        level: "error",
        service: `worker:${originalQueue}`,
        message: "dlq_enqueue_failed",
        jobId: String(job.id),
        queue: originalQueue,
        extra: { detail: msg }
      });
    });
  });
}
