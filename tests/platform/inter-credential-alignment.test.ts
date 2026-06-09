import { describe, expect, it } from "vitest";
import {
  extractIntegrationIdFromInterCert,
  validateInterCredentialAppAlignment
} from "../../src/platform/payment-gateway/inter-credential-alignment";
import { TEST_MTLS_CERTIFICATE_PEM } from "../fixtures/mtls-test-pem";

describe("inter-credential-alignment", () => {
  it("rejeita client_id que nao e UUID", () => {
    const r = validateInterCredentialAppAlignment("not-uuid", TEST_MTLS_CERTIFICATE_PEM);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/UUID/);
  });

  it("aceita certificado de teste sem OU de integracao Inter", () => {
    const r = validateInterCredentialAppAlignment(
      "4b8fb3b0-7c8e-4e28-a0fa-cf5cee8ceed2",
      TEST_MTLS_CERTIFICATE_PEM
    );
    expect(r.ok).toBe(true);
  });

  it("extractIntegrationIdFromInterCert retorna null para PEM invalido", () => {
    expect(extractIntegrationIdFromInterCert("-----BEGIN CERTIFICATE-----\nX\n-----END CERTIFICATE-----")).toBeNull();
  });
});
