import { describe, expect, it } from "vitest";
import { GatewayError } from "../../../src/modules/payment-gateway/domain/gateway-error";
import { PaymentGatewayError } from "../../../src/modules/payment-gateway/domain/payment-gateway-error";
import { classifyJobError } from "../../../src/platform/jobs/classify-job-error";

describe("classifyJobError", () => {
  it("GatewayError permanente → moveToDlq, não retryable", () => {
    const err = new GatewayError("validacao", {
      code: "gateway_validation_failed",
      retryable: false
    });
    const c = classifyJobError(err);
    expect(c.moveToDlq).toBe(true);
    expect(c.retryable).toBe(false);
    expect(c.errorCode).toBe("gateway_validation_failed");
  });

  it("GatewayError transitório → retryable, sem DLQ imediata", () => {
    const err = new GatewayError("timeout", {
      code: "gateway_timeout",
      retryable: true
    });
    const c = classifyJobError(err);
    expect(c.retryable).toBe(true);
    expect(c.moveToDlq).toBe(false);
  });

  it("PaymentGatewayError 503 → retryable", () => {
    const err = new PaymentGatewayError("indisponivel", {
      code: "gateway_unavailable",
      httpStatus: 503
    });
    const c = classifyJobError(err);
    expect(c.retryable).toBe(true);
    expect(c.moveToDlq).toBe(false);
  });

  it("PaymentGatewayError 422 → permanente", () => {
    const err = new PaymentGatewayError("invalido", {
      code: "gateway_validation_failed",
      httpStatus: 422
    });
    const c = classifyJobError(err);
    expect(c.retryable).toBe(false);
    expect(c.moveToDlq).toBe(true);
  });

  it("mensagem de validação de job → permanente", () => {
    const c = classifyJobError(new Error("Job paymentEmission exige chargeId e tenantId."));
    expect(c.errorCode).toBe("job_validation_failed");
    expect(c.moveToDlq).toBe(true);
  });

  it("erro desconhecido → retryable", () => {
    const c = classifyJobError(new Error("ECONNRESET"));
    expect(c.retryable).toBe(true);
    expect(c.moveToDlq).toBe(false);
    expect(c.errorCode).toBe("unknown_error");
  });
});
