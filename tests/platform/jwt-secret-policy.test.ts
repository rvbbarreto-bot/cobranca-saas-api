import { describe, expect, it } from "vitest";
import { validateJwtSecretForProduction } from "../../src/platform/config/jwt-secret-policy";

describe("validateJwtSecretForProduction", () => {
  it("aceita secret forte com 32+ caracteres", () => {
    expect(
      validateJwtSecretForProduction("0123456789abcdefghijklmnopqrstuvwxyzABCD")
    ).toEqual({ ok: true });
  });

  it("rejeita secret curto", () => {
    const r = validateJwtSecretForProduction("short");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toMatch(/32 caracteres/);
    }
  });

  it("rejeita placeholder TROCAR do .env.example", () => {
    const r = validateJwtSecretForProduction(
      "TROCAR_openssl_rand_base64_64_minimo_32_caracteres"
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toMatch(/placeholder/i);
    }
  });

  it("rejeita change-me", () => {
    const r = validateJwtSecretForProduction("change-me-to-a-strong-secret-extra-padding");
    expect(r.ok).toBe(false);
  });

  it("aceita exatamente 32 caracteres aleatorios", () => {
    expect(validateJwtSecretForProduction("abcdefghABCDEFGH1234567890abcdef")).toEqual({
      ok: true
    });
  });
});
