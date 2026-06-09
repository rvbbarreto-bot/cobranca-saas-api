import { describe, expect, it } from "vitest";
import { validateEncryptionKeyForProduction } from "../../src/platform/config/encryption-key-policy";

describe("validateEncryptionKeyForProduction", () => {
  it("aceita chave hex de 64 caracteres", () => {
    expect(
      validateEncryptionKeyForProduction(
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
      )
    ).toEqual({ ok: true });
  });

  it("rejeita chave ausente", () => {
    const r = validateEncryptionKeyForProduction(undefined);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/ausente/i);
  });

  it("rejeita placeholder do .env.example", () => {
    const r = validateEncryptionKeyForProduction("TROCAR_openssl_rand_hex_32_para_AES256GCM");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/placeholder/i);
  });

  it("rejeita formato nao-hex", () => {
    const r = validateEncryptionKeyForProduction("not-a-valid-hex-key-value-at-all-needs-64-chars!!");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/64 caracteres hex/i);
  });
});
