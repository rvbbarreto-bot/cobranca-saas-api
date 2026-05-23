import { describe, expect, it } from "vitest";
import { GatewayCredentialsValidationError } from "../../src/modules/payment-gateway/domain/payment-gateway-error";
import { mergeGatewayCredentialsPatch } from "../../src/platform/payment-gateway/credential-schema";
import { TEST_INTER_GATEWAY_CREDENTIALS } from "../fixtures/mtls-test-pem";

describe("mergeGatewayCredentialsPatch", () => {
  it("mescla patch parcial com credenciais existentes e valida PEM", () => {
    const existing = {
      client_id: "old-id",
      client_secret: "old-secret",
      certificate_pem: TEST_INTER_GATEWAY_CREDENTIALS.certificate_pem,
      private_key_pem: TEST_INTER_GATEWAY_CREDENTIALS.private_key_pem
    };
    const merged = mergeGatewayCredentialsPatch("inter", existing, {
      client_id: "new-id"
    });
    expect(merged.client_id).toBe("new-id");
    expect(merged.client_secret).toBe("old-secret");
    expect(merged.certificate_pem).toContain("BEGIN CERTIFICATE");
  });

  it("rejeita PEM invalido apos merge", () => {
    expect(() =>
      mergeGatewayCredentialsPatch(
        "inter",
        { client_id: "a", client_secret: "b", certificate_pem: "bad", private_key_pem: "bad" },
        { certificate_pem: "-----BEGIN CERTIFICATE-----\nX\n-----END CERTIFICATE-----" }
      )
    ).toThrow(GatewayCredentialsValidationError);
  });
});
