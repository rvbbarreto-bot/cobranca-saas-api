import { PaymentGatewayError } from "../../payment-gateway/domain/payment-gateway-error";
import { SaasBillingError } from "../domain/saas-billing-error";

function isAsaasAuthFailure(error: PaymentGatewayError): boolean {
  if (error.code === "gateway_auth_failed") {
    return true;
  }
  const status = error.httpStatus;
  return status === 401 || status === 403;
}

export function mapPlatformBillingGatewayError(error: unknown): never {
  if (error instanceof PaymentGatewayError) {
    if (isAsaasAuthFailure(error)) {
      throw new SaasBillingError(
        "PLATFORM_BILLING_AUTH_FAILED",
        "Chave de API Asaas da plataforma inválida ou expirada. Configure ASAAS_PLATFORM_API_KEY (sandbox: https://sandbox.asaas.com/) ou ASAAS_API_KEY válida no servidor."
      );
    }
    throw new SaasBillingError(
      "PLATFORM_BILLING_GATEWAY_ERROR",
      "Falha ao comunicar com o Asaas na cobrança recorrente. Tente novamente ou contacte o suporte."
    );
  }
  throw error;
}
