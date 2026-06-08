import { describe, expect, it } from "vitest";
import { GatewayCredentialsValidationError } from "../../src/modules/payment-gateway/domain/payment-gateway-error";
import { mergeGatewayCredentialsPatch } from "../../src/platform/payment-gateway/credential-schema";
import { TEST_INTER_GATEWAY_CREDENTIALS } from "../fixtures/mtls-test-pem";

describe("mergeGatewayCredentialsPatch", () => {
  it("mescla patch parcial com credenciais existentes e valida PEM", () => {
    const existing = {
      client_id: TEST_INTER_GATEWAY_CREDENTIALS.client_id,
      client_secret: "old-secret",
      certificate_pem: TEST_INTER_GATEWAY_CREDENTIALS.certificate_pem,
      private_key_pem: TEST_INTER_GATEWAY_CREDENTIALS.private_key_pem
    };
    const newClientId = "11111111-1111-4111-8111-111111111111";
    const merged = mergeGatewayCredentialsPatch("inter", existing, {
      client_id: newClientId
    });
    expect(merged.client_id).toBe(newClientId);
    expect(merged.client_secret).toBe("old-secret");
    expect(merged.certificate_pem).toContain("BEGIN CERTIFICATE");
  });

  it("rejeita PEM invalido apos merge", () => {
    expect(() =>
      mergeGatewayCredentialsPatch(
        "inter",
        {
          client_id: "22222222-2222-4222-8222-222222222222",
          client_secret: "b",
          certificate_pem: "bad",
          private_key_pem: "bad"
        },
        { certificate_pem: "-----BEGIN CERTIFICATE-----\nX\n-----END CERTIFICATE-----" }
      )
    ).toThrow(GatewayCredentialsValidationError);
  });
});
