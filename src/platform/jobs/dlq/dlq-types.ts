export type DlqJobPayload = {
  originalQueue: string;
  originalJobId: string;
  tenantId: string;
  chargeId?: string;
  inboxId?: string;
  attemptsMade: number;
  failedAt: string;
  errorCode: string;
  errorMessage: string;
  retryable: boolean;
  correlationId?: string;
  payload: unknown;
};

export function dlqQueueName(originalQueue: string): string {
  return `${originalQueue}-dlq`;
}
