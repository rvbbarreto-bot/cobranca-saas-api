export type JobLogLevel = "info" | "warn" | "error";

export type JobStructuredLogInput = {
  level: JobLogLevel;
  message: string;
  service: string;
  tenantId?: string;
  traceId?: string;
  correlationId?: string;
  jobId?: string;
  queue?: string;
  extra?: Record<string, unknown>;
};

/**
 * Log JSON estruturado para workers BullMQ (Sprint K — observabilidade).
 */
export function logJobStructured(input: JobStructuredLogInput): void {
  const line = {
    level: input.level,
    timestamp: new Date().toISOString(),
    service: input.service,
    message: input.message,
    tenantId: input.tenantId ?? null,
    traceId: input.traceId ?? input.correlationId ?? null,
    correlationId: input.correlationId ?? null,
    jobId: input.jobId ?? null,
    queue: input.queue ?? null,
    ...input.extra
  };
  const serialized = JSON.stringify(line);
  if (input.level === "error") {
    // eslint-disable-next-line no-console
    console.error(serialized);
  } else if (input.level === "warn") {
    // eslint-disable-next-line no-console
    console.warn(serialized);
  } else {
    // eslint-disable-next-line no-console
    console.log(serialized);
  }
}
