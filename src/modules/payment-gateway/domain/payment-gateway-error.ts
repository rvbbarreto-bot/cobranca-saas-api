export class PaymentGatewayError extends Error {
  readonly code: string;
  readonly httpStatus?: number;
  readonly providerBody?: unknown;

  constructor(
    message: string,
    options?: { code?: string; httpStatus?: number; providerBody?: unknown; cause?: unknown }
  ) {
    super(message, { cause: options?.cause });
    this.name = "PaymentGatewayError";
    this.code = options?.code ?? "payment_gateway_error";
    this.httpStatus = options?.httpStatus;
    this.providerBody = options?.providerBody;
  }
}
