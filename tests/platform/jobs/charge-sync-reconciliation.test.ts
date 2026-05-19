import { describe, expect, it, vi } from "vitest";
import type { PaymentGatewayAdapter } from "../../../src/modules/payment-gateway/domain/payment-gateway.interface";
import * as asaasStatusMap from "../../../src/modules/payment-gateway/domain/asaas-status-map";
import {
  canSyncReconciliationTransition,
  processChargeSyncReconciliation,
  reconcileOneCharge,
  type ChargeSyncCandidateRow
} from "../../../src/platform/jobs/application/charge-sync-reconciliation";

const baseRow: ChargeSyncCandidateRow = {
  charge_id: "charge-1",
  tenant_id: "00000000-0000-4000-8000-000000000001",
  canonical_status: "emitida",
  gateway_transaction_id: "pay_asaas_1",
  gateway_api_key_encrypted: "cipher",
  gateway_api_key_iv: "iv",
  gateway_provider: "asaas"
};

function mockAdapter(status: string): PaymentGatewayAdapter {
  return {
    createCustomer: vi.fn(),
    createBoleto: vi.fn(),
    createPix: vi.fn(),
    cancelCharge: vi.fn(),
    getCharge: vi.fn().mockResolvedValue({ status, id: "pay_asaas_1" })
  };
}

describe("canSyncReconciliationTransition", () => {
  it("permite emitida -> paga (CONFIRMED no gateway)", () => {
    expect(canSyncReconciliationTransition("emitida", "paga")).toBe("allow");
  });

  it("nega retrocesso pendente_pagamento -> emitida", () => {
    expect(canSyncReconciliationTransition("pendente_pagamento", "emitida")).toBe("deny");
  });

  it("noop quando status igual", () => {
    expect(canSyncReconciliationTransition("emitida", "emitida")).toBe("noop");
  });
});

describe("reconcileOneCharge", () => {
  it("atualiza emitida para paga quando gateway retorna CONFIRMED", async () => {
    const queries: string[] = [];
    const withTenant = vi.fn(async (_tenantId: string, fn: (client: unknown) => Promise<void>) => {
      const client = {
        query: vi.fn(async (sql: string) => {
          queries.push(sql);
          return { rowCount: 1, rows: [] };
        })
      };
      await fn(client);
    });

    const outcome = await reconcileOneCharge(baseRow, {
      decryptApiKey: () => "api-key",
      createAdapter: () => mockAdapter("CONFIRMED"),
      withTenant: withTenant as never
    });

    expect(outcome).toBe("updated");
    expect(queries.some((q) => q.includes("UPDATE charges"))).toBe(true);
    expect(queries.some((q) => q.includes("INSERT INTO charge_events"))).toBe(true);
  });

  it("ignora transicao invalida com aviso (retrocesso)", async () => {
    const warnings: string[] = [];
    const withTenant = vi.fn();
    const mapSpy = vi.spyOn(asaasStatusMap, "mapAsaasPaymentStatus").mockReturnValue("emitida");

    const outcome = await reconcileOneCharge(
      { ...baseRow, canonical_status: "pendente_pagamento" },
      {
        decryptApiKey: () => "api-key",
        createAdapter: () => mockAdapter("UNKNOWN"),
        withTenant: withTenant as never,
        logWarn: (msg) => warnings.push(msg)
      }
    );

    mapSpy.mockRestore();

    expect(outcome).toBe("skipped");
    expect(withTenant).not.toHaveBeenCalled();
    expect(warnings.some((w) => w.includes("transicao ignorada"))).toBe(true);
  });
});

describe("processChargeSyncReconciliation", () => {
  it("falha em uma cobranca nao impede processamento do lote", async () => {
    const rows = [
      baseRow,
      { ...baseRow, charge_id: "charge-2", gateway_transaction_id: "pay_2" }
    ];
    let calls = 0;

    const summary = await processChargeSyncReconciliation({
      pool: { query: vi.fn().mockResolvedValue({ rows }) } as never,
      decryptApiKey: () => "key",
      createAdapter: () => {
        calls += 1;
        if (calls === 1) {
          throw new Error("asaas down");
        }
        return mockAdapter("CONFIRMED");
      },
      withTenant: vi.fn(async (_t, fn) => {
        const client = { query: vi.fn().mockResolvedValue({ rowCount: 1, rows: [] }) };
        await fn(client);
      }) as never
    });

    expect(summary.processed).toBe(2);
    expect(summary.errors).toBe(1);
    expect(summary.updated).toBe(1);
  });
});
