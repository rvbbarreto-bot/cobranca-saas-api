import { describe, expect, it } from "vitest";
import { cobrancaFormSchema, loginFormSchema } from "./schemas";

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

  it("rejeita tenant vazio", () => {
    const r = loginFormSchema.safeParse({
      email: "a@b.co",
      tenant_id: "   ",
      password: "x"
    });
    expect(r.success).toBe(false);
  });
});

describe("cobrancaFormSchema", () => {
  it("aceita dados validos sem cliente", () => {
    const r = cobrancaFormSchema.safeParse({
      reference: "REF-1",
      amount: 10.5,
      due_date: "2030-01-15",
      portal_cliente_id: ""
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.portal_cliente_id).toBeUndefined();
    }
  });

  it("rejeita valor nao positivo", () => {
    const r = cobrancaFormSchema.safeParse({
      reference: "R",
      amount: 0,
      due_date: "2030-01-15"
    });
    expect(r.success).toBe(false);
  });

  it("rejeita data invalida", () => {
    const r = cobrancaFormSchema.safeParse({
      reference: "R",
      amount: 1,
      due_date: "15-01-2030"
    });
    expect(r.success).toBe(false);
  });
});
