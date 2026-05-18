import { describe, expect, it } from "vitest";
import {
  isValidBrDocumentoDigits,
  onlyDigits,
  parsePortalClienteCreateBody
} from "../../src/modules/portal-read/application/portal-cliente-input";

const CPF_VALIDO = "390.533.447-05";
const CPF_DV_INVALIDO = "123.456.789-01";
const CNPJ_VALIDO = "11.222.333/0001-81";

describe("onlyDigits", () => {
  it("remove caracteres nao numericos", () => {
    expect(onlyDigits("12.345.678/0001-90")).toBe("12345678000190");
    expect(onlyDigits(CPF_VALIDO)).toBe("39053344705");
  });
});

describe("isValidBrDocumentoDigits", () => {
  it("aceita 11 ou 14 digitos", () => {
    expect(isValidBrDocumentoDigits("39053344705")).toBe(true);
    expect(isValidBrDocumentoDigits("12345678000190")).toBe(true);
  });
  it("rejeita outros tamanhos", () => {
    expect(isValidBrDocumentoDigits("123")).toBe(false);
    expect(isValidBrDocumentoDigits("")).toBe(false);
  });
});

describe("parsePortalClienteCreateBody", () => {
  it("aceita payload valido minimo com CPF valido", () => {
    const r = parsePortalClienteCreateBody({
      documento: CPF_VALIDO,
      nome: "Maria Silva"
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.documento).toBe("39053344705");
      expect(r.value.nome).toBe("Maria Silva");
      expect(r.value.email).toBe(null);
      expect(r.value.whatsappOptIn).toBe(false);
    }
  });

  it("aceita email e whatsapp_opt_in com CNPJ valido", () => {
    const r = parsePortalClienteCreateBody({
      documento: CNPJ_VALIDO,
      nome: "Empresa X",
      email: " contato@empresa.com ",
      whatsapp_opt_in: true
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.documento).toBe("11222333000181");
      expect(r.value.email).toBe("contato@empresa.com");
      expect(r.value.whatsappOptIn).toBe(true);
    }
  });

  it("rejeita documento com tamanho invalido", () => {
    const r = parsePortalClienteCreateBody({ documento: "123", nome: "A" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issues.some((i) => i.path === "documento")).toBe(true);
    }
  });

  it("rejeita CPF com digitos verificadores incorretos", () => {
    const r = parsePortalClienteCreateBody({ documento: CPF_DV_INVALIDO, nome: "X" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issues.some((i) => i.path === "documento")).toBe(true);
    }
  });

  it("rejeita nome vazio", () => {
    const r = parsePortalClienteCreateBody({ documento: CPF_VALIDO, nome: "   " });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issues.some((i) => i.path === "nome")).toBe(true);
    }
  });

  it("rejeita corpo nao objeto", () => {
    const r = parsePortalClienteCreateBody(null);
    expect(r.ok).toBe(false);
  });

  it("rejeita email malformado quando informado", () => {
    const r = parsePortalClienteCreateBody({
      documento: CPF_VALIDO,
      nome: "X",
      email: "sem-arroba"
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issues.some((i) => i.path === "email")).toBe(true);
    }
  });

  it("rejeita whatsapp_opt_in nao boolean", () => {
    const r = parsePortalClienteCreateBody({
      documento: CPF_VALIDO,
      nome: "X",
      whatsapp_opt_in: "sim"
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issues.some((i) => i.path === "whatsapp_opt_in")).toBe(true);
    }
  });
});
