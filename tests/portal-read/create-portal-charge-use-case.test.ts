import { describe, expect, it, vi, beforeEach } from "vitest";
import type { PoolClient } from "pg";
import { createPortalChargeUseCase } from "../../src/modules/portal-read/application/create-portal-charge";

const { enqueueMock } = vi.hoisted(() => ({
  enqueueMock: vi.fn()
}));

vi.mock("../../src/platform/audit/audit.service", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined)
}));

vi.mock("../../src/platform/jobs/enqueue-payment-emission", () => ({
  schedulePaymentEmissionJob: (charge: { id: string; tenantId: string }) => {
    enqueueMock(charge);
  },
  enqueuePaymentEmissionJob: enqueueMock
}));

vi.mock("../../src/modules/saas-billing/application/assert-tenant-can-mutate", () => ({
  assertTenantCanMutate: vi.fn().mockResolvedValue(undefined),
  recordChargeCreatedForMetering: vi.fn().mockResolvedValue(undefined)
}));

vi.mock("../../src/modules/billing-core/infrastructure/charge-repository", () => ({
  insertCharge: vi.fn().mockResolvedValue({
    inserted: true,
    charge: {
      id: "c1",
      tenantId: "00000000-0000-4000-8000-000000000001",
      reference: "r1",
      idempotencyKey: "idem-12345678",
      amount: "10.00",
      dueDate: "2030-06-01",
      canonicalStatus: "rascunho",
      provider: null,
      providerChargeId: null,
      metadata: { portal_cliente_id: "20000000-0000-4000-8000-000000000088" },
      createdAt: "2020-01-01T00:00:00.000Z",
      updatedAt: "2020-01-01T00:00:00.000Z"
    }
  })
}));

describe("createPortalChargeUseCase", () => {
  beforeEach(() => {
    enqueueMock.mockClear();
  });

  it("criacao bem-sucedida enfileira job na fila charges:emission", async () => {
    const client = {
      query: vi.fn().mockResolvedValue({ rowCount: 1 })
    } as unknown as PoolClient;

    const out = await createPortalChargeUseCase(
      client,
      "1",
      "00000000-0000-4000-8000-000000000001",
      {
        reference: "r1",
        idempotency_key: "idem-12345678",
        amount: 10,
        due_date: "2030-06-01",
        portal_cliente_id: "20000000-0000-4000-8000-000000000088"
      }
    );

    expect(out.inserted).toBe(true);
    expect(out.charge.canonicalStatus).toBe("rascunho");
    expect(enqueueMock).toHaveBeenCalledWith({
      id: "c1",
      tenantId: "00000000-0000-4000-8000-000000000001"
    });
  });
});
