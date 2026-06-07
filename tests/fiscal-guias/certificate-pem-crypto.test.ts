import { describe, expect, it } from "vitest";
import {
  computeCertificateVaultStatus,
  decryptCertificadoBundle,
  encryptCertificadoBundle
} from "../../src/modules/fiscal-guias/infrastructure/certificate-pem-crypto";

describe("certificate-pem-crypto", () => {
  it("encrypt/decrypt bundle roundtrip", () => {
    const enc = encryptCertificadoBundle("cert-pem", "key-pem");
    const dec = decryptCertificadoBundle(enc.cert_encrypted, enc.key_encrypted, enc.encryption_iv);
    expect(dec.certificadoPem).toBe("cert-pem");
    expect(dec.chavePrivadaPem).toBe("key-pem");
  });

  it("computeCertificateVaultStatus expiring dentro de 30 dias", () => {
    const asOf = new Date("2026-06-01T12:00:00Z");
    expect(computeCertificateVaultStatus("2026-06-20", asOf)).toBe("expiring");
    expect(computeCertificateVaultStatus("2026-08-01", asOf)).toBe("active");
    expect(computeCertificateVaultStatus("2026-05-01", asOf)).toBe("expired");
  });
});
