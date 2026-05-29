import { describe, expect, it, vi, beforeEach } from "vitest";
import type { PoolClient } from "pg";
import { PortalEmissionNotReadyError } from "../../src/modules/portal-read/application/assert-portal-charge-emission-ready";
import { reprocessPortalChargeEmissionUseCase } from "../../src/modules/portal-read/application/reprocess-portal-charge-emission";

const getChargeById = vi.fn();
const getChargeWithLatestPayment = vi.fn();
const insertChargeEvent = vi.fn();
const writeAuditLog = vi.fn();
const schedulePaymentEmissionJob = vi.fn();

vi.mock("../../src/modules/billing-core/infrastructure/charge-repository", () => ({
  getChargeById: (...args: unknown[]) => getChargeById(...args),
  getChargeWithLatestPayment: (...args: unknown[]) => getChargeWithLatestPayment(...args)
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

const assertPortalChargeEmissionReady = vi.fn();

vi.mock("../../src/modules/portal-read/application/assert-portal-charge-emission-ready", () => ({
  assertPortalChargeEmissionReady: (...args: unknown[]) => assertPortalChargeEmissionReady(...args),
  PortalEmissionNotReadyError: class PortalEmissionNotReadyError extends Error {
    issues: Array<{ path: string; message: string }>;
    constructor(issues: Array<{ path: string; message: string }>) {
      super(issues[0]?.message ?? "not ready");
      this.issues = issues;
    }
  }
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
    assertPortalChargeEmissionReady.mockResolvedValue(undefined);
  });

  it("volta erro_emissao para rascunho, registra evento e agenda job", async () => {
    getChargeById
      .mockResolvedValueOnce(sampleCharge)
      .mockResolvedValueOnce({ ...sampleCharge, canonicalStatus: "rascunho" });

    const out = await reprocessPortalChargeEmissionUseCase(client, "auto-1", "c1", { userId: "u1" });
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

  it("rejeita status diferente de erro_emissao/rascunho", async () => {
    getChargeById.mockResolvedValue({ ...sampleCharge, canonicalStatus: "emitida" });

    const out = await reprocessPortalChargeEmissionUseCase(client, "auto-1", "c1");
    expect(out).toEqual({ ok: false, kind: "illegal_status", status: "emitida" });
    expect(client.query).not.toHaveBeenCalled();
  });

  it("reprocessa rascunho preso (velho, sem payment): re-enfileira sem mudar status", async () => {
    const stale = { ...sampleCharge, canonicalStatus: "rascunho" as const };
    getChargeById.mockResolvedValue(stale);
    getChargeWithLatestPayment.mockResolvedValue({ charge: stale, payment: null });

    const out = await reprocessPortalChargeEmissionUseCase(client, "auto-1", "c1", { userId: "u1" });

    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.charge.canonicalStatus).toBe("rascunho");
      expect(out.jobScheduled).toBe(true);
    }
    expect(insertChargeEvent).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        eventType: "emission.reprocess",
        oldStatus: "rascunho",
        newStatus: "rascunho",
        payload: expect.objectContaining({ reason: "manual_reprocess_stale" })
      })
    );
    expect(schedulePaymentEmissionJob).toHaveBeenCalledWith({ id: "c1", tenantId: "t1" });
    // Sem transição de status: nenhum UPDATE direto na tabela.
    expect(client.query).not.toHaveBeenCalled();
  });

  it("rejeita rascunho que já possui payment (emissão concluída)", async () => {
    const draft = { ...sampleCharge, canonicalStatus: "rascunho" as const };
    getChargeById.mockResolvedValue(draft);
    getChargeWithLatestPayment.mockResolvedValue({
      charge: draft,
      payment: { type: "boleto" }
    });

    const out = await reprocessPortalChargeEmissionUseCase(client, "auto-1", "c1");
    expect(out).toEqual({ ok: false, kind: "illegal_status", status: "rascunho" });
    expect(schedulePaymentEmissionJob).not.toHaveBeenCalled();
  });

  it("rejeita reprocesso quando emissao nao esta pronta (endereco)", async () => {
    getChargeById.mockResolvedValue({
      ...sampleCharge,
      metadata: { portal_cliente_id: "cli-1" }
    });
    assertPortalChargeEmissionReady.mockRejectedValue(
      new PortalEmissionNotReadyError([
        {
          path: "portal_cliente_id",
          message: "Banco Inter exige endereco completo do cliente (CEP, logradouro, bairro, cidade e UF)."
        }
      ])
    );

    const out = await reprocessPortalChargeEmissionUseCase(client, "auto-1", "c1");
    expect(out).toEqual({
      ok: false,
      kind: "validation_error",
      issues: [
        {
          path: "portal_cliente_id",
          message: "Banco Inter exige endereco completo do cliente (CEP, logradouro, bairro, cidade e UF)."
        }
      ]
    });
    expect(schedulePaymentEmissionJob).not.toHaveBeenCalled();
  });

  it("rejeita rascunho recém-criado (idade abaixo do orçamento)", async () => {
    const fresh = {
      ...sampleCharge,
      canonicalStatus: "rascunho" as const,
      createdAt: new Date().toISOString()
    };
    getChargeById.mockResolvedValue(fresh);
    getChargeWithLatestPayment.mockResolvedValue({ charge: fresh, payment: null });

    const out = await reprocessPortalChargeEmissionUseCase(client, "auto-1", "c1");
    expect(out).toEqual({ ok: false, kind: "illegal_status", status: "rascunho" });
    expect(schedulePaymentEmissionJob).not.toHaveBeenCalled();
  });
});
