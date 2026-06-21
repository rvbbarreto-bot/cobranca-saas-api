export class SaasBillingError extends Error {
  readonly code:
    | "PLAN_NOT_FOUND"
    | "SUBSCRIPTION_NOT_FOUND"
    | "SUBSCRIPTION_READ_ONLY"
    | "SUBSCRIPTION_ALREADY_ACTIVATED"
    | "SUBSCRIPTION_NOT_ELIGIBLE"
    | "PLATFORM_BILLING_NOT_CONFIGURED"
    | "PLATFORM_BILLING_AUTH_FAILED"
    | "PLATFORM_BILLING_GATEWAY_ERROR"
    | "LIMIT_CLIENTES"
    | "LIMIT_COBRANCAS_MES";

  constructor(
    code: SaasBillingError["code"],
    message: string
  ) {
    super(message);
    this.name = "SaasBillingError";
    this.code = code;
  }
}
