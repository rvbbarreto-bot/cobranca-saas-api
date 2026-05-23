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

  it("rejeita remover email (null ou vazio)", () => {
    expect(parsePortalClientePatchBody({ email: null }).ok).toBe(false);
    expect(parsePortalClientePatchBody({ email: "   " }).ok).toBe(false);
  });

  it("aceita telefone com digitos", () => {
    const r = parsePortalClientePatchBody({ telefone: "(11) 98765-4321" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.telefone).toBe("11987654321");
    }
  });

  it("rejeita email invalido", () => {
    const r = parsePortalClientePatchBody({ email: "sem-arroba" });
    expect(r.ok).toBe(false);
  });

  it("exige telefone ao ativar whatsapp_opt_in sem telefone no corpo", () => {
    const r = parsePortalClientePatchBody({ whatsapp_opt_in: true });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issues.some((i) => i.path === "telefone")).toBe(true);
    }
  });

  it("aceita whatsapp_opt_in com telefone", () => {
    const r = parsePortalClientePatchBody({ whatsapp_opt_in: true, telefone: "11999998888" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.whatsappOptIn).toBe(true);
      expect(r.value.telefone).toBe("11999998888");
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
