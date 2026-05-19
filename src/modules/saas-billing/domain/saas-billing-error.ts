export class SaasBillingError extends Error {
  readonly code:
    | "PLAN_NOT_FOUND"
    | "SUBSCRIPTION_NOT_FOUND"
    | "SUBSCRIPTION_READ_ONLY"
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
