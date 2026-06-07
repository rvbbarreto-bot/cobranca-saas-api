import { describe, expect, it, vi } from "vitest";
import type { PoolClient } from "pg";
import { handleFiscalGuiaReconciliationInboxPayload } from "../../src/modules/fiscal-guias/application/handle-fiscal-guia-reconciliation-inbox";

describe("handleFiscalGuiaReconciliationInboxPayload", () => {
  it("retorna not_fiscal para evento desconhecido", async () => {
    const client = { query: vi.fn() } as unknown as PoolClient;
    const r = await handleFiscalGuiaReconciliationInboxPayload(
      "00000000-0000-4000-8000-000000000001",
      { event_type: "charge.paid" },
      client
    );
    expect(r.kind).toBe("not_fiscal");
  });

  it("retorna disabled quando flag fiscal desligada", async () => {
    const prev = process.env.FISCAL_GUIAS_ENABLED;
    process.env.FISCAL_GUIAS_ENABLED = "false";

    const client = { query: vi.fn() } as unknown as PoolClient;
    const r = await handleFiscalGuiaReconciliationInboxPayload(
      "00000000-0000-4000-8000-000000000001",
      {
        event_type: "fiscal.guia.reconciliation.requested",
        idempotency_key: "rec-1",
        valor_pago: 250,
        data_pagamento: "2026-06-20",
        guia_fiscal_id: "550e8400-e29b-41d4-a716-446655440000"
      },
      client
    );
    expect(r.kind).toBe("disabled");

    if (prev === undefined) delete process.env.FISCAL_GUIAS_ENABLED;
    else process.env.FISCAL_GUIAS_ENABLED = prev;
  });
});
