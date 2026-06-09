import { beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { generateKeyPairSync } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  extractSinglePemForField,
  validatePemFileLocal
} from "../../src/platform/certificate-validation/pem-local-validation";
import {
  buildIntegrationPayload,
  validatePemPairDeep
} from "../../src/platform/certificate-validation/pem-deep-validation";
import { validateAndStoreCertificateUpload } from "../../src/platform/certificate-validation/validate-certificate-upload";
import { clearCertificateUploadMemoryStore } from "../../src/platform/certificate-validation/certificate-upload-store";

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../fixtures");
const CERT = fs.readFileSync(path.join(fixturesDir, "test-mtls.crt"));
const KEY = fs.readFileSync(path.join(fixturesDir, "test-mtls.key"));

describe("pem-local-validation", () => {
  it("rejeita extensão inválida (CA-02)", () => {
    const result = validatePemFileLocal(Buffer.from("x"), "file.pdf", "certificate");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error_code).toBe("ERR-001");
    }
  });

  it("rejeita arquivo maior que 64 KB (CA-03)", () => {
    const big = Buffer.alloc(65 * 1024, 0x41);
    const result = validatePemFileLocal(big, "big.pem", "certificate");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error_code).toBe("ERR-004");
    }
  });

  it("aceita certificado PEM válido", () => {
    const result = validatePemFileLocal(CERT, "cert.crt", "certificate");
    expect(result.ok).toBe(true);
  });

  it("rejeita chave no campo certificado (ERR-002)", () => {
    const result = validatePemFileLocal(KEY, "key.pem", "certificate");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error_code).toBe("ERR-002");
    }
  });
});

describe("pem-deep-validation", () => {
  it("valida par certificado/chave (CA-06 positivo)", () => {
    const certPem = extractSinglePemForField(CERT, "certificate")!;
    const keyPem = extractSinglePemForField(KEY, "private_key")!;
    const result = validatePemPairDeep(certPem, keyPem, new Date("2026-06-01T00:00:00Z"));
    expect(result.ok).toBe(true);
  });

  it("rejeita par incorreto (CA-06)", () => {
    const certPem = extractSinglePemForField(CERT, "certificate")!;
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const wrongKey = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    const result = validatePemPairDeep(certPem, wrongKey, new Date("2026-06-01T00:00:00Z"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error_code).toBe("ERR-007");
    }
  });

  it("retorna WARN-001 quando expira em menos de 30 dias (CA-05)", () => {
    const certPem = extractSinglePemForField(CERT, "certificate")!;
    const keyPem = extractSinglePemForField(KEY, "private_key")!;
    const result = validatePemPairDeep(certPem, keyPem, new Date("2027-05-10T00:00:00Z"));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.warnings).toContain("WARN-001");
    }
  });

  it("gera payload JSON completo (CA-08)", () => {
    const certPem = extractSinglePemForField(CERT, "certificate")!;
    const keyPem = extractSinglePemForField(KEY, "private_key")!;
    const payload = buildIntegrationPayload("id-test", certPem, keyPem, new Date("2026-06-01T00:00:00Z"));
    expect(payload).toBeTruthy();
    expect(payload!.certificate_der).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(payload!.private_key_der).toMatch(/^[A-Za-z0-9+/=]+$/);
    expect(payload!.subject_cn).toBe("local-test");
    expect(payload!.key_algorithm).toBeTruthy();
    expect(payload!.fingerprint_sha256).toMatch(/^[0-9A-F:]+$/);
  });
});

describe("validateAndStoreCertificateUpload", () => {
  beforeEach(() => {
    clearCertificateUploadMemoryStore();
  });

  it("armazena upload e retorna certificate_id (CA-10)", async () => {
    const result = await validateAndStoreCertificateUpload({
      tenantId: "tenant-a",
      userId: "user-a",
      certificateBuffer: CERT,
      certificateFilename: "cert.crt",
      privateKeyBuffer: KEY,
      privateKeyFilename: "key.key",
      now: new Date("2026-06-01T00:00:00Z")
    });
    expect("certificate_id" in result).toBe(true);
    if ("certificate_id" in result) {
      expect(result.certificate_id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
      expect(result.info.length).toBeGreaterThan(0);
    }
  });
});
