import { describe, expect, it } from "vitest";
import {
  sanitizePemPaste,
  validateMtlsPemPair
} from "../../src/platform/payment-gateway/mtls-credential-validation";
import {
  TEST_MTLS_CERTIFICATE_PEM,
  TEST_MTLS_PRIVATE_KEY_PEM
} from "../fixtures/mtls-test-pem";

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

  it("aceita par PEM valido de fixture", () => {
    const r = validateMtlsPemPair(TEST_MTLS_CERTIFICATE_PEM, TEST_MTLS_PRIVATE_KEY_PEM);
    expect(r.ok).toBe(true);
  });

  it("remove prompt do PowerShell colado apos a chave", () => {
    const dirtyKey = `${TEST_MTLS_PRIVATE_KEY_PEM}\nPS C:\\Projeto\\Inter_API-Chave_e_Certificado>`;
    const cleaned = sanitizePemPaste(dirtyKey);
    expect(cleaned).not.toMatch(/PS C:/);
    const r = validateMtlsPemPair(TEST_MTLS_CERTIFICATE_PEM, cleaned);
    expect(r.ok).toBe(true);
  });

  it("mensagem amigavel quando PEM esta truncado", () => {
    const r = validateMtlsPemPair(
      TEST_MTLS_CERTIFICATE_PEM,
      "-----BEGIN PRIVATE KEY-----\nnot-valid-base64\n-----END PRIVATE KEY-----"
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.message).toMatch(/invalido|invalid/i);
    }
  });
});
