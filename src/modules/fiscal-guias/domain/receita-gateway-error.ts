export class ReceitaGatewayError extends Error {
  readonly code: string;
  readonly httpStatus?: number;
  readonly providerBody?: unknown;

  constructor(
    message: string,
    options?: { code?: string; httpStatus?: number; providerBody?: unknown; cause?: unknown }
  ) {
    super(message, { cause: options?.cause });
    this.name = "ReceitaGatewayError";
    this.code = options?.code ?? "receita_gateway_error";
    this.httpStatus = options?.httpStatus;
    this.providerBody = options?.providerBody;
  }
}
