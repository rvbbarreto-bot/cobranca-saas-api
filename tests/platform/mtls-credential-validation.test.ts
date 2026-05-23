import { describe, expect, it } from "vitest";
import { validateMtlsPemPair } from "../../src/platform/payment-gateway/mtls-credential-validation";

describe("validateMtlsPemPair", () => {
  it("rejeita certificado sem marcador PEM", () => {
    const r = validateMtlsPemPair("not-a-cert", "-----BEGIN PRIVATE KEY-----\nMIIE\n-----END PRIVATE KEY-----");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).toMatch(/CERTIFICATE/i);
    }
  });

  it("rejeita chave sem marcador PEM", () => {
    const r = validateMtlsPemPair(
      "-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----",
      "not-a-key"
    );
    expect(r.ok).toBe(false);
  });
});
