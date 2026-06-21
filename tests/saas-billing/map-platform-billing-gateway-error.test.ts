import { describe, expect, it } from "vitest";
import { GatewayAuthError, PaymentGatewayError } from "../../src/modules/payment-gateway/domain/payment-gateway-error";
import { mapPlatformBillingGatewayError } from "../../src/modules/saas-billing/application/map-platform-billing-gateway-error";
import { SaasBillingError } from "../../src/modules/saas-billing/domain/saas-billing-error";

describe("mapPlatformBillingGatewayError", () => {
  it("mapeia 401 do Asaas para PLATFORM_BILLING_AUTH_FAILED", () => {
    expect(() =>
      mapPlatformBillingGatewayError(
        new GatewayAuthError("asaas", "Asaas HTTP 401: invalid", { httpStatus: 401 })
      )
    ).toThrow(SaasBillingError);

    try {
      mapPlatformBillingGatewayError(
        new PaymentGatewayError("Asaas HTTP 401: x", { code: "asaas_api_error", httpStatus: 401 })
      );
    } catch (error) {
      expect(error).toBeInstanceOf(SaasBillingError);
      expect((error as SaasBillingError).code).toBe("PLATFORM_BILLING_AUTH_FAILED");
    }
  });

  it("mapeia outros erros de gateway para PLATFORM_BILLING_GATEWAY_ERROR", () => {
    try {
      mapPlatformBillingGatewayError(
        new PaymentGatewayError("Asaas HTTP 500", { code: "asaas_api_error", httpStatus: 500 })
      );
    } catch (error) {
      expect((error as SaasBillingError).code).toBe("PLATFORM_BILLING_GATEWAY_ERROR");
    }
  });
});
