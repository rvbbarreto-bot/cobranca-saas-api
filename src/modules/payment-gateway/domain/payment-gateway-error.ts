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

export class GatewayNotConfiguredError extends PaymentGatewayError {
  constructor(tenantId: string) {
    super(`Gateway nao configurado para tenant ${tenantId}.`, { code: "gateway_not_configured" });
    this.name = "GatewayNotConfiguredError";
  }
}

export class GatewayCredentialsMissingError extends PaymentGatewayError {
  constructor(provider: string, missingFields: string[]) {
    super(`Credenciais incompletas para ${provider}: ${missingFields.join(", ")}.`, {
      code: "gateway_credentials_missing"
    });
    this.name = "GatewayCredentialsMissingError";
  }
}

export class UnsupportedGatewayProviderError extends PaymentGatewayError {
  readonly provider: string;

  constructor(provider: string) {
    super(`Provedor de gateway nao suportado: ${provider}.`, { code: "unsupported_gateway_provider" });
    this.name = "UnsupportedGatewayProviderError";
    this.provider = provider;
  }
}

export class GatewayAuthError extends PaymentGatewayError {
  readonly provider: string;

  constructor(provider: string, message: string, options?: { httpStatus?: number; providerBody?: unknown }) {
    super(message, {
      code: "gateway_auth_error",
      httpStatus: options?.httpStatus,
      providerBody: options?.providerBody
    });
    this.name = "GatewayAuthError";
    this.provider = provider;
  }
}

export class GatewayProviderError extends PaymentGatewayError {
  readonly provider: string;

  constructor(
    provider: string,
    message: string,
    options?: { code?: string; httpStatus?: number; providerBody?: unknown; cause?: unknown }
  ) {
    super(message, {
      code: options?.code ?? "gateway_provider_error",
      httpStatus: options?.httpStatus,
      providerBody: options?.providerBody,
      cause: options?.cause
    });
    this.name = "GatewayProviderError";
    this.provider = provider;
  }
}
