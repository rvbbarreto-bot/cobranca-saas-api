import { describe, expect, it } from "vitest";
import {
  clienteFormSchema,
  cobrancaEditFormSchema,
  cobrancaFormSchema,
  loginFormSchema,
  normalizeClientePayload
} from "./schemas";

const CPF_MASK = "390.533.447-05";
const CNPJ_MASK = "11.222.333/0001-81";

describe("loginFormSchema", () => {
  it("aceita dados validos", () => {
    const r = loginFormSchema.safeParse({
      email: "a@b.co",
      tenant_id: "1",
      password: "x"
    });
    expect(r.success).toBe(true);
  });

  it("rejeita email invalido", () => {
    const r = loginFormSchema.safeParse({
      email: "nope",
      tenant_id: "1",
      password: "x"
    });
    expect(r.success).toBe(false);
  });
});

describe("clienteFormSchema", () => {
  it("aceita PF com CPF valido e email", () => {
    const r = clienteFormSchema.safeParse({
      tipo: "PF",
      documento: CPF_MASK,
      nome: "Maria Silva",
      email: "maria@exemplo.com",
      whatsapp_opt_in: false
    });
    expect(r.success).toBe(true);
    if (r.success) {
      const p = normalizeClientePayload(r.data);
      expect(p.documento).toBe("39053344705");
      expect(p.email).toBe("maria@exemplo.com");
    }
  });

  it("rejeita CPF com DV invalido", () => {
    const r = clienteFormSchema.safeParse({
      tipo: "PF",
      documento: "111.111.111-11",
      nome: "Teste",
      email: "a@b.co",
      whatsapp_opt_in: false
    });
    expect(r.success).toBe(false);
  });

  it("exige telefone quando opt-in marcado", () => {
    const r = clienteFormSchema.safeParse({
      tipo: "PJ",
      documento: CNPJ_MASK,
      nome: "Empresa X",
      email: "c@x.com",
      whatsapp_opt_in: true
    });
    expect(r.success).toBe(false);
  });

  it("aceita PJ com telefone e opt-in", () => {
    const r = clienteFormSchema.safeParse({
      tipo: "PJ",
      documento: CNPJ_MASK,
      nome: "Empresa X",
      email: "c@x.com",
      telefone: "(11) 98765-4321",
      whatsapp_opt_in: true
    });
    expect(r.success).toBe(true);
  });
});

describe("cobrancaFormSchema", () => {
  it("aceita dados validos sem cliente (Asaas)", () => {
    const r = cobrancaFormSchema.safeParse({
      reference: "REF-1",
      amount: 10.5,
      due_date: "2030-01-15",
      portal_cliente_id: ""
    });
    expect(r.success).toBe(true);
  });

  it("rejeita valor zero", () => {
    const r = cobrancaFormSchema.safeParse({
      reference: "REF-1",
      amount: 0,
      due_date: "2030-01-15"
    });
    expect(r.success).toBe(false);
  });
});

describe("cobrancaEditFormSchema", () => {
  it("aceita valor e vencimento validos", () => {
    const r = cobrancaEditFormSchema.safeParse({ amount: 99.9, due_date: "2030-12-01" });
    expect(r.success).toBe(true);
  });
});
