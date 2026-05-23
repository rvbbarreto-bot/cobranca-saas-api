import { describe, expect, it, vi, beforeEach } from "vitest";
import type { PoolClient } from "pg";
import { reprocessPortalChargeEmissionUseCase } from "../../src/modules/portal-read/application/reprocess-portal-charge-emission";

const getChargeById = vi.fn();
const insertChargeEvent = vi.fn();
const writeAuditLog = vi.fn();
const schedulePaymentEmissionJob = vi.fn();

vi.mock("../../src/modules/billing-core/infrastructure/charge-repository", () => ({
  getChargeById: (...args: unknown[]) => getChargeById(...args)
}));

vi.mock("../../src/modules/billing-core/infrastructure/charge-events-repository", () => ({
  insertChargeEvent: (...args: unknown[]) => insertChargeEvent(...args)
}));

vi.mock("../../src/platform/audit/audit.service", () => ({
  writeAuditLog: (...args: unknown[]) => writeAuditLog(...args)
}));

vi.mock("../../src/platform/jobs/enqueue-payment-emission", () => ({
  schedulePaymentEmissionJob: (...args: unknown[]) => schedulePaymentEmissionJob(...args)
}));

const sampleCharge = {
  id: "c1",
  tenantId: "t1",
  reference: "r1",
  idempotencyKey: "idem",
  amount: "10.00",
  dueDate: "2030-01-01",
  canonicalStatus: "erro_emissao" as const,
  provider: null,
  providerChargeId: null,
  metadata: {},
  createdAt: "2020-01-01T00:00:00.000Z",
  updatedAt: "2020-01-01T00:00:00.000Z"
};

describe("reprocessPortalChargeEmissionUseCase", () => {
  const client = {
    query: vi.fn().mockResolvedValue({ rowCount: 1 })
  } as unknown as PoolClient;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("volta erro_emissao para rascunho, registra evento e agenda job", async () => {
    getChargeById
      .mockResolvedValueOnce(sampleCharge)
      .mockResolvedValueOnce({ ...sampleCharge, canonicalStatus: "rascunho" });

    const out = await reprocessPortalChargeEmissionUseCase(client, "c1", { userId: "u1" });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.charge.canonicalStatus).toBe("rascunho");
      expect(out.jobScheduled).toBe(true);
    }
    expect(insertChargeEvent).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        eventType: "emission.reprocess",
        oldStatus: "erro_emissao",
        newStatus: "rascunho"
      })
    );
    expect(schedulePaymentEmissionJob).toHaveBeenCalledWith({ id: "c1", tenantId: "t1" });
    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "status_change" }),
      client
    );
  });

  it("rejeita status diferente de erro_emissao", async () => {
    getChargeById.mockResolvedValue({ ...sampleCharge, canonicalStatus: "emitida" });

    const out = await reprocessPortalChargeEmissionUseCase(client, "c1");
    expect(out).toEqual({ ok: false, kind: "illegal_status", status: "emitida" });
    expect(client.query).not.toHaveBeenCalled();
  });
});
