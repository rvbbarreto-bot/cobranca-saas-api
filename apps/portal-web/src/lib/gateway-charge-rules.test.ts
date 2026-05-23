import { describe, expect, it } from "vitest";
import { buildCobrancaFormSchema } from "./cobranca-form";
import { getPortalChargeRules, sanitizeChargeReference } from "./gateway-charge-rules";

describe("gateway-charge-rules Inter", () => {
  const rules = getPortalChargeRules("inter");
  const schema = buildCobrancaFormSchema(rules);

  it("trava referencia em 80 e alfanumerico", () => {
    const long = "A".repeat(81);
    const r = schema.safeParse({
      reference: long,
      amount: 10,
      due_date: "2099-12-31"
    });
    expect(r.success).toBe(false);
    expect(sanitizeChargeReference("abc!@#", rules)).toBe("abc");
  });

  it("Inter exige endereco do pagador nas regras de gateway", () => {
    expect(rules.requiresPayerAddress).toBe(true);
  });

  it("exige cliente para Inter", () => {
    const r = schema.safeParse({
      reference: "Mensalidade",
      amount: 100,
      due_date: "2099-12-31"
    });
    expect(r.success).toBe(false);
  });

  it("rejeita valor abaixo de 0.01", () => {
    const r = schema.safeParse({
      reference: "Teste",
      amount: 0,
      due_date: "2099-12-31",
      portal_cliente_id: "550e8400-e29b-41d4-a716-446655440000"
    });
    expect(r.success).toBe(false);
  });
});
