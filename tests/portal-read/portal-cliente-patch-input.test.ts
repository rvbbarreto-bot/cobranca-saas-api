import { describe, expect, it } from "vitest";
import { parsePortalClientePatchBody } from "../../src/modules/portal-read/application/portal-cliente-input";

describe("parsePortalClientePatchBody", () => {
  it("rejeita corpo vazio", () => {
    const r = parsePortalClientePatchBody({});
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issues[0]?.path).toBe("body");
    }
  });

  it("aceita apenas nome", () => {
    const r = parsePortalClientePatchBody({ nome: "  Novo nome  " });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.nome).toBe("Novo nome");
    }
  });

  it("aceita email null e string vazia como null", () => {
    expect(parsePortalClientePatchBody({ email: null }).ok).toBe(true);
    const r2 = parsePortalClientePatchBody({ email: "   " });
    expect(r2.ok).toBe(true);
    if (r2.ok) {
      expect(r2.value.email).toBeNull();
    }
  });

  it("rejeita email invalido", () => {
    const r = parsePortalClientePatchBody({ email: "sem-arroba" });
    expect(r.ok).toBe(false);
  });

  it("aceita whatsapp_opt_in", () => {
    const r = parsePortalClientePatchBody({ whatsapp_opt_in: true });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.whatsappOptIn).toBe(true);
    }
  });

  it("rejeita whatsapp_opt_in nao boolean", () => {
    const r = parsePortalClientePatchBody({ whatsapp_opt_in: "sim" });
    expect(r.ok).toBe(false);
  });

  it("combina campos", () => {
    const r = parsePortalClientePatchBody({
      nome: "A",
      email: "a@b.co",
      whatsapp_opt_in: false
    });
    expect(r.ok).toBe(true);
  });
});
