import { isGatewayError } from "../../modules/payment-gateway/domain/gateway-error";

export type JobErrorClassification = {
  retryable: boolean;
  moveToDlq: boolean;
  errorCode: string;
  errorMessage: string;
};

const PERMANENT_JOB_CODES = new Set([
  "gateway_validation_failed",
  "escritorio_config_not_found",
  "gateway_provider_unsupported",
  "gateway_auth_failed",
  "job_validation_failed"
]);

/**
 * Classifica falha de worker para retry BullMQ vs movimentação para DLQ.
 */
export function classifyJobError(err: unknown): JobErrorClassification {
  if (isGatewayError(err)) {
    return {
      retryable: err.retryable,
      moveToDlq: !err.retryable,
      errorCode: err.code,
      errorMessage: err.message
    };
  }

  if (err instanceof Error) {
    const lower = err.message.toLowerCase();
    if (
      lower.includes("exige") ||
      lower.includes("invalid") ||
      lower.includes("malformed") ||
      lower.includes("sem credenciais")
    ) {
      return {
        retryable: false,
        moveToDlq: true,
        errorCode: "job_validation_failed",
        errorMessage: err.message
      };
    }

    if (PERMANENT_JOB_CODES.has((err as Error & { code?: string }).code ?? "")) {
      return {
        retryable: false,
        moveToDlq: true,
        errorCode: (err as Error & { code?: string }).code ?? "job_validation_failed",
        errorMessage: err.message
      };
    }
  }

  return {
    retryable: true,
    moveToDlq: false,
    errorCode: "unknown_error",
    errorMessage: err instanceof Error ? err.message : String(err)
  };
}
