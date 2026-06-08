import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  validateAllowedExtension,
  validatePemFileLocal,
  pemPreviewLines
} from "./pem-local-validation";

const fixturesDir = path.dirname(fileURLToPath(import.meta.url));
const cert = fs.readFileSync(
  path.join(fixturesDir, "../../../../tests/fixtures/test-mtls.crt"),
  "utf8"
);

describe("portal pem-local-validation", () => {
  it("rejeita .pdf imediatamente (CA-02)", () => {
    const result = validatePemFileLocal("not pem", "doc.pdf", "certificate", 10);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error_code).toBe("ERR-001");
    }
  });

  it("aceita extensões permitidas", () => {
    expect(validateAllowedExtension("a.crt")).toBe(true);
    expect(validateAllowedExtension("a.key")).toBe(true);
    expect(validateAllowedExtension("a.txt")).toBe(false);
  });

  it("valida certificado localmente", () => {
    const result = validatePemFileLocal(cert, "cert.pem", "certificate", cert.length);
    expect(result.ok).toBe(true);
  });

  it("exibe preview header/footer (RF-08)", () => {
    const preview = pemPreviewLines(cert);
    expect(preview?.header).toMatch(/^-----BEGIN CERTIFICATE-----$/);
    expect(preview?.footer).toMatch(/^-----END CERTIFICATE-----$/);
  });
});
