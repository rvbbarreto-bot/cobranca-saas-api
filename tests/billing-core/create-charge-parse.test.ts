import { describe, expect, it } from "vitest";
import { createChargeBodySchema } from "../../src/modules/billing-core/application/create-charge";

describe("createChargeBodySchema", () => {
  it("parse minimo valido", () => {
    const r = createChargeBodySchema.safeParse({
      reference: "ref-1",
      idempotency_key: "12345678",
      amount: 0.01,
      due_date: "2030-06-01"
    });
    expect(r.success).toBe(true);
  });

  it("rejeita idempotency curta", () => {
    const r = createChargeBodySchema.safeParse({
      reference: "r",
      idempotency_key: "short",
      amount: 1,
      due_date: "2030-06-01"
    });
    expect(r.success).toBe(false);
  });

  it("rejeita amount zero", () => {
    const r = createChargeBodySchema.safeParse({
      reference: "r",
      idempotency_key: "12345678",
      amount: 0,
      due_date: "2030-06-01"
    });
    expect(r.success).toBe(false);
  });

  it("aceita opcionais provider", () => {
    const r = createChargeBodySchema.safeParse({
      reference: "r",
      idempotency_key: "12345678",
      amount: 2,
      due_date: "2030-06-01",
      provider: "pix",
      provider_charge_id: "ext-1",
      metadata: { a: 1 }
    });
    expect(r.success).toBe(true);
  });
});
