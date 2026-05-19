import { describe, expect, it, vi } from "vitest";
import type { PoolClient } from "pg";
import { createChargeUseCase } from "../../src/modules/billing-core/application/create-charge";

const { enqueueMock } = vi.hoisted(() => ({
  enqueueMock: vi.fn()
}));

vi.mock("../../src/platform/audit/audit.service", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined)
}));

vi.mock("../../src/platform/jobs/enqueue-payment-emission", () => ({
  schedulePaymentEmissionJob: (charge: { id: string; tenantId: string }) => {
    enqueueMock(charge);
  }
}));

vi.mock("../../src/modules/billing-core/infrastructure/charge-events-repository", () => ({
  insertChargeEvent: vi.fn().mockResolvedValue(undefined)
}));

vi.mock("../../src/modules/billing-core/infrastructure/charge-repository", () => ({
  insertCharge: vi.fn().mockResolvedValue({
    inserted: true,
    charge: {
      id: "c1",
      tenantId: "t1",
      reference: "r1",
      idempotencyKey: "idem-12345678",
      amount: "1.00",
      dueDate: "2030-06-01",
      type: "boleto",
      canonicalStatus: "rascunho",
      provider: null,
      providerChargeId: null,
      metadata: {},
      createdAt: "2020-01-01T00:00:00.000Z",
      updatedAt: "2020-01-01T00:00:00.000Z"
    }
  })
}));

describe("createChargeUseCase", () => {
  it("delega a insertCharge quando valido", async () => {
    const { insertCharge } = await import("../../src/modules/billing-core/infrastructure/charge-repository");
    const client = {} as PoolClient;
    const out = await createChargeUseCase(client, {
      reference: "r1",
      idempotency_key: "idem-12345678",
      amount: 1,
      due_date: "2030-06-01"
    });
    expect(out.inserted).toBe(true);
    expect(out.charge.reference).toBe("r1");
    expect(insertCharge).toHaveBeenCalledWith(client, expect.objectContaining({ reference: "r1" }));
  });

  it("grava audit quando inserido e contexto informado", async () => {
    const { writeAuditLog } = await import("../../src/platform/audit/audit.service");
    const client = {} as PoolClient;
    await createChargeUseCase(
      client,
      {
        reference: "r1",
        idempotency_key: "idem-12345678",
        amount: 1,
        due_date: "2030-06-01"
      },
      { userId: "user-1" }
    );
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "create", resourceType: "charge", userId: "user-1" }),
      client
    );
  });

  it("enfileira emissao quando inserido", async () => {
    enqueueMock.mockClear();
    const client = {} as PoolClient;
    await createChargeUseCase(client, {
      reference: "r1",
      idempotency_key: "idem-12345678",
      amount: 1,
      due_date: "2030-06-01"
    });
    expect(enqueueMock).toHaveBeenCalledWith({ id: "c1", tenantId: "t1" });
  });

  it("propaga VALIDATION_ERROR", async () => {
    const client = {} as PoolClient;
    await expect(createChargeUseCase(client, { reference: "", idempotency_key: "x", amount: -1, due_date: "bad" })).rejects.toMatchObject({
      message: "VALIDATION_ERROR"
    });
  });
});
