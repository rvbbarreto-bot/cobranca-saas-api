import { describe, expect, it, vi } from "vitest";
import type { PoolClient } from "pg";
import { patchPortalChargeUseCase } from "../../src/modules/portal-read/application/patch-portal-charge";

function chargeRow(over: Partial<Record<string, unknown>> = {}) {
  const now = new Date();
  return {
    id: "11111111-1111-4111-8111-111111111111",
    tenant_id: "00000000-0000-4000-8000-000000000001",
    reference: "ref-x",
    idempotency_key: "idem-key-12345678",
    amount: "10.00",
    due_date: new Date("2030-01-15"),
    canonical_status: "emitida",
    provider: null,
    provider_charge_id: null,
    metadata: { a: 1 },
    created_at: now,
    updated_at: now,
    ...over
  };
}

describe("patchPortalChargeUseCase", () => {
  it("422 em body vazio", async () => {
    const client = { query: vi.fn() } as unknown as PoolClient;
    const r = await patchPortalChargeUseCase(client, "11111111-1111-4111-8111-111111111111", {});
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.kind).toBe("validation");
    }
    expect(client.query).not.toHaveBeenCalled();
  });

  it("404 quando cobranca nao existe", async () => {
    const client = { query: vi.fn().mockResolvedValue({ rows: [] }) } as unknown as PoolClient;
    const r = await patchPortalChargeUseCase(client, "11111111-1111-4111-8111-111111111111", {
      amount: 5
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.kind).toBe("not_found");
    }
  });

  it("409 quando cobranca paga", async () => {
    const client = {
      query: vi.fn().mockResolvedValueOnce({ rows: [chargeRow({ canonical_status: "paga" })] })
    } as unknown as PoolClient;
    const r = await patchPortalChargeUseCase(client, "11111111-1111-4111-8111-111111111111", {
      amount: 5
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.kind).toBe("not_editable");
    }
  });

  it("200 atualiza amount", async () => {
    const updated = chargeRow({ amount: "55.00", due_date: new Date("2030-01-15") });
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [chargeRow()] })
        .mockResolvedValueOnce({ rows: [updated] })
    } as unknown as PoolClient;

    const r = await patchPortalChargeUseCase(client, "11111111-1111-4111-8111-111111111111", {
      amount: 55
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.charge.amount).toBe("55.00");
    }
  });
});
