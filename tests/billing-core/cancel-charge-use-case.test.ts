import { describe, expect, it, vi, beforeEach } from "vitest";
import type { PoolClient } from "pg";
import { cancelChargeUseCase } from "../../src/modules/billing-core/application/cancel-charge";

const getChargeById = vi.fn();
const writeAuditLog = vi.fn();

vi.mock("../../src/modules/billing-core/infrastructure/charge-repository", () => ({
  getChargeById: (...args: unknown[]) => getChargeById(...args)
}));

vi.mock("../../src/platform/audit/audit.service", () => ({
  writeAuditLog: (...args: unknown[]) => writeAuditLog(...args)
}));

describe("cancelChargeUseCase", () => {
  const client = {
    query: vi.fn().mockResolvedValue({ rowCount: 1 })
  } as unknown as PoolClient;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("cancela cobranca emitida e grava audit", async () => {
    getChargeById
      .mockResolvedValueOnce({
        id: "c1",
        tenantId: "t1",
        reference: "r1",
        idempotencyKey: "idem",
        amount: "10.00",
        dueDate: "2030-01-01",
        canonicalStatus: "emitida",
        provider: null,
        providerChargeId: null,
        metadata: {},
        createdAt: "2020-01-01T00:00:00.000Z",
        updatedAt: "2020-01-01T00:00:00.000Z"
      })
      .mockResolvedValueOnce({
        id: "c1",
        tenantId: "t1",
        reference: "r1",
        idempotencyKey: "idem",
        amount: "10.00",
        dueDate: "2030-01-01",
        canonicalStatus: "cancelada",
        provider: null,
        providerChargeId: null,
        metadata: {},
        createdAt: "2020-01-01T00:00:00.000Z",
        updatedAt: "2020-01-01T00:00:00.000Z"
      });

    const out = await cancelChargeUseCase(client, "c1", { userId: "u1" });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.charge.canonicalStatus).toBe("cancelada");
    }
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "cancel",
        resourceType: "charge",
        resourceId: "c1",
        oldValue: { canonical_status: "emitida" }
      }),
      client
    );
  });

  it("rejeita transicao ilegal de paga", async () => {
    getChargeById.mockResolvedValue({
      id: "c1",
      tenantId: "t1",
      canonicalStatus: "paga"
    });

    const out = await cancelChargeUseCase(client, "c1");
    expect(out).toEqual({
      ok: false,
      kind: "illegal_transition",
      from: "paga",
      to: "cancelada"
    });
    expect(client.query).not.toHaveBeenCalled();
  });
});
