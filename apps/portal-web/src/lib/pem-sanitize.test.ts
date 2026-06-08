import { describe, expect, it } from "vitest";
import { sanitizeGatewayCredentials, sanitizePemPaste } from "./pem-sanitize";

const KEY = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC7
-----END PRIVATE KEY-----`;

describe("pem-sanitize", () => {
  it("extrai bloco PEM e descarta prompt do terminal", () => {
    const dirty = `${KEY}\nPS C:\\Projeto\\Inter>`;
    expect(sanitizePemPaste(dirty)).toBe(KEY);
  });

  it("sanitiza campos de credencial do gateway", () => {
    const out = sanitizeGatewayCredentials({
      client_id: "abc",
      private_key_pem: `${KEY}\nPS C:\\x>`
    });
    expect(out.private_key_pem).toBe(KEY);
    expect(out.client_id).toBe("abc");
  });
});
