import { describe, expect, it } from "vitest";
import { buildMtlsAgent } from "../../../src/platform/payment-gateway/mtls-agent";

const FIXTURE_CERT = `-----BEGIN CERTIFICATE-----
MIIBkTCB+wIJAKHBfpE3Q3RkMA0GCSqGSIb3DQEBCwUAMBQxEjAQBgNVBAMMCWxv
Y2FsLXRlc3QwHhcNMjUwMTAxMDAwMDAwWhcNMzUwMTAxMDAwMDAwWjAUMRIwEAYD
VQQDDAlsb2NhbC10ZXN0MFwwDQYJKoZIhvcNAQEBBQADSwAUA0gAUACyFixture
-----END CERTIFICATE-----`;

const FIXTURE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCyFixtureKey
-----END PRIVATE KEY-----`;

describe("buildMtlsAgent", () => {
  it("monta Agent com PEM de fixture", () => {
    const agent = buildMtlsAgent({ certPem: FIXTURE_CERT, keyPem: FIXTURE_KEY });
    expect(agent).toBeDefined();
    expect(agent.options.cert).toBeTruthy();
    expect(agent.options.key).toBeTruthy();
  });

  it("rejeita PEM vazio", () => {
    expect(() => buildMtlsAgent({ certPem: "", keyPem: FIXTURE_KEY })).toThrow(
      /certificate_pem/
    );
  });
});
