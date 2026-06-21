import { describe, expect, it } from "vitest";
import { classifyMtlsTransportError, MtlsTransportError } from "../../../src/platform/payment-gateway/mtls-transport-error";

describe("classifyMtlsTransportError", () => {
  it("mapeia unknown_ca para handshake permanente", () => {
    const err = classifyMtlsTransportError(
      new Error("write EPROTO ... SSL alert number 48 unknown ca")
    );
    expect(err).toBeInstanceOf(MtlsTransportError);
    expect(err.code).toBe("mtls_handshake_failed");
    expect(err.retryable).toBe(false);
    expect(err.message).toMatch(/unknown_ca/i);
  });

  it("mapeia DNS para erro de rede", () => {
    const err = classifyMtlsTransportError(new Error("getaddrinfo EAI_AGAIN cdpj-sandbox.partners.uatinter.co"));
    expect(err.code).toBe("mtls_network_error");
  });
});

describe("isGatewaySandboxMode", () => {
  it("honra GATEWAY_INTER_SANDBOX para inter", async () => {
    const prev = process.env.GATEWAY_INTER_SANDBOX;
    process.env.GATEWAY_INTER_SANDBOX = "true";
    const { isGatewaySandboxMode } = await import("../../../src/platform/payment-gateway/gateway-sandbox");
    expect(isGatewaySandboxMode("inter")).toBe(true);
    process.env.GATEWAY_INTER_SANDBOX = "false";
    expect(isGatewaySandboxMode("inter")).toBe(false);
    if (prev === undefined) {
      delete process.env.GATEWAY_INTER_SANDBOX;
    } else {
      process.env.GATEWAY_INTER_SANDBOX = prev;
    }
  });
});
