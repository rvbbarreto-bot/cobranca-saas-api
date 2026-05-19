import { describe, expect, it } from "vitest";
import {
  parsePatchPortalChargeBody,
  patchPortalChargeBodySchema
} from "../../src/modules/portal-read/application/patch-portal-charge";

describe("patchPortalChargeBodySchema", () => {
  it("exige ao menos um campo", () => {
    const r = patchPortalChargeBodySchema.safeParse({});
    expect(r.success).toBe(false);
  });

  it("aceita amount", () => {
    const r = patchPortalChargeBodySchema.safeParse({ amount: 10.5 });
    expect(r.success).toBe(true);
  });

  it("aceita due_date", () => {
    const r = patchPortalChargeBodySchema.safeParse({ due_date: "2030-01-15" });
    expect(r.success).toBe(true);
  });

  it("rejeita due_date invalida", () => {
    const r = patchPortalChargeBodySchema.safeParse({ due_date: "15-01-2030" });
    expect(r.success).toBe(false);
  });

  it("aceita metadata", () => {
    const r = patchPortalChargeBodySchema.safeParse({ metadata: { k: 1 } });
    expect(r.success).toBe(true);
  });

  it("rejeita amount nao positivo", () => {
    const r = patchPortalChargeBodySchema.safeParse({ amount: 0 });
    expect(r.success).toBe(false);
  });
});

describe("parsePatchPortalChargeBody", () => {
  it("retorna issues em falha", () => {
    const r = parsePatchPortalChargeBody({});
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.issues.length).toBeGreaterThan(0);
    }
  });

  it("retorna value em sucesso", () => {
    const r = parsePatchPortalChargeBody({ amount: 1 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.amount).toBe(1);
    }
  });
});
