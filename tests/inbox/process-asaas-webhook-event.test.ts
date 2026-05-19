import { describe, expect, it, vi, beforeEach } from "vitest";
import { applyAsaasWebhookEvent } from "../../src/modules/inbox/application/process-asaas-webhook-event";
import type { AsaasWebhookContext } from "../../src/modules/inbox/application/parse-asaas-webhook-context";

const { addMock, getJobMock, removeMock } = vi.hoisted(() => ({
  addMock: vi.fn().mockResolvedValue({ id: "job-1" }),
  getJobMock: vi.fn().mockResolvedValue(null),
  removeMock: vi.fn().mockResolvedValue(undefined)
}));

vi.mock("../../src/platform/audit/audit.service", () => ({
  writeAuditLog: vi.fn().mockResolvedValue(undefined)
}));

vi.mock("../../src/platform/jobs/redis-connection", () => ({
  isJobsEnabled: () => true
}));

vi.mock("../../src/platform/jobs/queues", () => ({
  getQueues: () => ({
    notificationSend: {
      add: addMock,
      getJob: getJobMock
    }
  }),
  JOB_OPTS: {
    notification: { attempts: 3 }
  }
}));

const tenantId = "00000000-0000-4000-8000-000000000001";
const chargeId = "11111111-1111-4111-8111-111111111111";

function asaasCtx(event: string, canonicalStatus: AsaasWebhookContext["instruction"]["canonicalStatus"]): AsaasWebhookContext {
  return {
    event,
    instruction: {
      canonicalStatus,
      providerChargeId: "pay_asaas_1"
    },
    valorPago: 150.5,
    dataPagamento: "2026-05-01"
  };
}

function mockClient(sequence: {
  chargeStatus: string;
  updateRowCount?: number;
}): { query: ReturnType<typeof vi.fn> } {
  return {
    query: vi.fn(async (sql: string) => {
      if (sql.includes("SELECT id::text AS id, canonical_status")) {
        return { rows: [{ id: chargeId, canonical_status: sequence.chargeStatus }] };
      }
      if (sql.includes("UPDATE charges")) {
        const rowCount = sequence.updateRowCount ?? 1;
        return { rowCount, rows: rowCount ? [{ id: chargeId }] : [] };
      }
      if (sql.includes("INSERT INTO charge_events") || sql.includes("payment_transactions")) {
        return { rowCount: 1, rows: [] };
      }
      return { rowCount: 0, rows: [] };
    })
  };
}

describe("applyAsaasWebhookEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("PAYMENT_CONFIRMED → paga com side effect payment_confirmed", async () => {
    const client = mockClient({ chargeStatus: "emitida" });
    const result = await applyAsaasWebhookEvent(
      client as never,
      tenantId,
      asaasCtx("PAYMENT_CONFIRMED", "paga")
    );

    expect(result.outcome).toBe("applied");
    if (result.outcome === "applied") {
      expect(result.sideEffect.kind).toBe("payment_confirmed");
    }
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("canonical_status NOT IN ('paga', 'cancelada')"),
      expect.any(Array)
    );
  });

  it("PAYMENT_RECEIVED → mesma lógica de PAYMENT_CONFIRMED", async () => {
    const client = mockClient({ chargeStatus: "pendente_pagamento" });
    const result = await applyAsaasWebhookEvent(
      client as never,
      tenantId,
      asaasCtx("PAYMENT_RECEIVED", "paga")
    );

    expect(result.outcome).toBe("applied");
    if (result.outcome === "applied") {
      expect(result.sideEffect.kind).toBe("payment_confirmed");
    }
  });

  it("PAYMENT_OVERDUE → vencida com side effect payment_overdue", async () => {
    const client = mockClient({ chargeStatus: "pendente_pagamento" });
    const result = await applyAsaasWebhookEvent(
      client as never,
      tenantId,
      asaasCtx("PAYMENT_OVERDUE", "vencida")
    );

    expect(result.outcome).toBe("applied");
    if (result.outcome === "applied") {
      expect(result.sideEffect.kind).toBe("payment_overdue");
    }
  });

  it("PAYMENT_DELETED → cancelada e side effect payment_cancelled", async () => {
    const client = mockClient({ chargeStatus: "emitida" });
    const result = await applyAsaasWebhookEvent(
      client as never,
      tenantId,
      asaasCtx("PAYMENT_DELETED", "cancelada")
    );

    expect(result.outcome).toBe("applied");
    if (result.outcome === "applied") {
      expect(result.sideEffect.kind).toBe("payment_cancelled");
    }
  });

  it("PAYMENT_RESTORED → emitida apenas se estava cancelada", async () => {
    const client = mockClient({ chargeStatus: "cancelada" });
    const result = await applyAsaasWebhookEvent(
      client as never,
      tenantId,
      asaasCtx("PAYMENT_RESTORED", "emitida")
    );

    expect(result.outcome).toBe("applied");
    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("AND canonical_status = 'cancelada'"),
      expect.any(Array)
    );
  });

  it("PAYMENT_CONFIRMED em cobrança já paga → noop idempotente", async () => {
    const client = mockClient({ chargeStatus: "paga", updateRowCount: 0 });
    const result = await applyAsaasWebhookEvent(
      client as never,
      tenantId,
      asaasCtx("PAYMENT_CONFIRMED", "paga")
    );

    expect(result.outcome).toBe("noop");
    const updateCalls = (client.query as ReturnType<typeof vi.fn>).mock.calls.filter((c) =>
      String(c[0]).includes("UPDATE charges")
    );
    expect(updateCalls).toHaveLength(0);
  });
});

describe("applyWebhookSideEffectPlan", () => {
  beforeEach(() => {
    addMock.mockClear();
    getJobMock.mockClear();
    removeMock.mockClear();
    getJobMock.mockResolvedValue({ remove: removeMock });
  });

  it("payment_confirmed enfileira payment-confirmed e cancela régua", async () => {
    const { applyWebhookSideEffectPlan } = await import(
      "../../src/platform/jobs/application/webhook-side-effects"
    );

    await applyWebhookSideEffectPlan({
      kind: "payment_confirmed",
      chargeId,
      tenantId
    });

    expect(addMock).toHaveBeenCalledWith(
      "payment-confirmed",
      expect.objectContaining({ eventType: "pagamento_confirmado" }),
      expect.any(Object)
    );
    expect(getJobMock).toHaveBeenCalled();
    expect(addMock).not.toHaveBeenCalledWith("emit", expect.anything(), expect.anything());
  });

  it("payment_overdue enfileira regua D+3 e D+7 com jobId", async () => {
    const { applyWebhookSideEffectPlan } = await import(
      "../../src/platform/jobs/application/webhook-side-effects"
    );

    await applyWebhookSideEffectPlan({
      kind: "payment_overdue",
      chargeId,
      tenantId
    });

    expect(addMock).toHaveBeenCalledWith(
      "regua",
      expect.objectContaining({ eventType: "pos_vencimento_3d", daysOffset: 3 }),
      expect.objectContaining({ jobId: `regua-${chargeId}-3` })
    );
    expect(addMock).toHaveBeenCalledWith(
      "regua",
      expect.objectContaining({ eventType: "pos_vencimento_7d", daysOffset: 7 }),
      expect.objectContaining({ jobId: `regua-${chargeId}-7` })
    );
  });
});
