/**
 * Erros tipados de integração bancária (ADR-001 / Sprint K).
 * Todo adapter deve lançar GatewayError ou PaymentGatewayError com retryable explícito.
 */

export type GatewayErrorCode =
  | "gateway_provider_unsupported"
  | "gateway_auth_failed"
  | "gateway_rate_limited"
  | "gateway_validation_failed"
  | "gateway_timeout"
  | "gateway_unavailable"
  | "escritorio_config_not_found"
  | "payment_gateway_error";

const PERMANENT_CODES = new Set<GatewayErrorCode>([
  "gateway_provider_unsupported",
  "gateway_validation_failed",
  "escritorio_config_not_found",
  "gateway_auth_failed"
]);

export function inferGatewayRetryable(code: string, httpStatus?: number): boolean {
  if (PERMANENT_CODES.has(code as GatewayErrorCode)) {
    return false;
  }
  if (httpStatus === 400 || httpStatus === 401 || httpStatus === 403 || httpStatus === 422) {
    return false;
  }
  if (httpStatus === 429) {
    return true;
  }
  if (httpStatus !== undefined && httpStatus >= 500) {
    return true;
  }
  if (code === "gateway_timeout" || code === "gateway_unavailable" || code === "gateway_rate_limited") {
    return true;
  }
  return code === "payment_gateway_error";
}

export class GatewayError extends Error {
  readonly code: GatewayErrorCode;
  readonly retryable: boolean;
  readonly httpStatus?: number;
  readonly provider?: string;
  readonly providerBody?: unknown;

  constructor(
    message: string,
    options: {
      code: GatewayErrorCode;
      retryable?: boolean;
      httpStatus?: number;
      provider?: string;
      providerBody?: unknown;
      cause?: unknown;
    }
  ) {
    super(message, { cause: options.cause });
    this.name = "GatewayError";
    this.code = options.code;
    this.retryable = options.retryable ?? inferGatewayRetryable(options.code, options.httpStatus);
    this.httpStatus = options.httpStatus;
    this.provider = options.provider;
    this.providerBody = options.providerBody;
  }
}

export function isGatewayError(err: unknown): err is GatewayError {
  return err instanceof GatewayError;
}
