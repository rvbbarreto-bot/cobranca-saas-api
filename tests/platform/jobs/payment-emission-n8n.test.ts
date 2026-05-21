import { beforeEach, describe, expect, it, vi } from "vitest";
import { UnrecoverableError } from "bullmq";
import type { PoolClient } from "pg";
import type { PaymentGatewayAdapter } from "../../../src/modules/payment-gateway/domain/payment-gateway.interface";

const emitN8nMock = vi.hoisted(() => vi.fn());

vi.mock("../../../src/platform/integrations/n8n-outbound", () => ({
  emitN8nPlatformEvent: emitN8nMock
}));

import {
  processPaymentEmission,
  type ChargeRow
} from "../../../src/platform/jobs/application/payment-emission-processor";

const tenantId = "00000000-0000-4000-8000-000000000001";
const chargeId = "10000000-0000-4000-8000-000000000099";
const clienteId = "20000000-0000-4000-8000-000000000088";
const automacaoTenantId = "escritorio-automacao-1";

function baseCharge(overrides: Partial<ChargeRow> = {}): ChargeRow {
  return {
    id: chargeId,
    tenantId,
    reference: "REF-N8N",
    idempotencyKey: "idem-n8n-12345678",
    amount: "100.00",
    dueDate: "2030-06-15",
    canonicalStatus: "rascunho",
    type: "boleto",
    metadata: {
      portal_cliente_id: clienteId,
      portal_automacao_tenant_id: automacaoTenantId
    },
    ...overrides
  };
}

type MockState = {
  charge: ChargeRow | null;
  cliente: {
    id: string;
    tenant_id: string;
    documento: string;
    nome: string;
    email: string;
    telefone: string | null;
    gateway_customer_id: string | null;
  };
};

function createMockClient(state: MockState): PoolClient {
  return {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      const q = sql.replace(/\s+/g, " ").trim().toLowerCase();

      if (q.startsWith("select id, tenant_id, reference") && q.includes("from charges")) {
        if (!state.charge) {
          return { rows: [] };
        }
        const reqId = params?.[0];
        const reqTenant = params?.[1];
        if (state.charge.id !== reqId || state.charge.tenantId !== reqTenant) {
          return { rows: [] };
        }
        const c = state.charge;
        return {
          rows: [
            {
              id: c.id,
              tenant_id: c.tenantId,
              reference: c.reference,
              idempotency_key: c.idempotencyKey,
              amount: c.amount,
              due_date: c.dueDate,
              canonical_status: c.canonicalStatus,
              type: c.type,
              metadata: c.metadata
            }
          ]
        };
      }

      if (q.includes("from escritorio_config")) {
        return {
          rows: [
            {
              gateway_provider: "asaas",
              gateway_api_key_encrypted: "cipher",
              encryption_iv: "iv"
            }
          ]
        };
      }

      if (q.includes("from portal.cliente")) {
        return { rows: [state.cliente] };
      }

      if (q.startsWith("update portal.cliente")) {
        state.cliente.gateway_customer_id = String(params?.[1]);
        return { rowCount: 1, rows: [] };
      }

      if (q.startsWith("insert into payment_transactions")) {
        return { rowCount: 1, rows: [] };
      }

      if (q.startsWith("update charges") && q.includes("emitida")) {
        if (state.charge) {
          state.charge = { ...state.charge, canonicalStatus: "emitida" };
        }
        return { rowCount: 1, rows: [] };
      }

      if (q.startsWith("insert into charge_events")) {
        return { rowCount: 1, rows: [] };
      }

      if (q.startsWith("insert into audit_log")) {
        return { rowCount: 1, rows: [] };
      }

      return { rows: [], rowCount: 0 };
    })
  } as unknown as PoolClient;
}

function createAdapterMock(overrides: Partial<PaymentGatewayAdapter> = {}): PaymentGatewayAdapter {
  return {
    createCustomer: vi.fn().mockResolvedValue("cus_asaas_1"),
    createBoleto: vi.fn().mockResolvedValue({
      gatewayTransactionId: "pay_boleto_1",
      boletoUrl: "https://boleto",
      boletoPdfUrl: "https://pdf",
      barCode: "123",
      identificationField: "linha",
      nossoNumero: "nn",
      expiresAt: new Date("2030-06-15T23:59:59.999Z")
    }),
    createPix: vi.fn(),
    cancelCharge: vi.fn(),
    getCharge: vi.fn(),
    ...overrides
  };
}

describe("processPaymentEmission — n8n charge.emitted", () => {
  let state: MockState;

  beforeEach(() => {
    vi.clearAllMocks();
    state = {
      charge: baseCharge(),
      cliente: {
        id: clienteId,
        tenant_id: automacaoTenantId,
        documento: "12345678909",
        nome: "Cliente Teste",
        email: "c@test.com",
        telefone: null,
        gateway_customer_id: "cus_1"
      }
    };
  });

  const deps = () => ({
    withTenant: async (_tid: string, fn: (c: PoolClient) => Promise<void>) => fn(createMockClient(state)),
    createAdapter: () => createAdapterMock(),
    decryptApiKey: () => "asaas_key_test"
  });

  it("emite charge.emitted apos emissao gateway com sucesso", async () => {
    await processPaymentEmission({ chargeId, tenantId }, deps());

    expect(emitN8nMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "charge.emitted",
        tenant_id: tenantId,
        payload: { charge_id: chargeId }
      })
    );
  });

  it("nao emite charge.emitted quando emissao falha", async () => {
    const badAdapter = createAdapterMock({
      createBoleto: vi.fn().mockRejectedValue(new Error("gateway down"))
    });

    await expect(
      processPaymentEmission(
        { chargeId, tenantId },
        {
          ...deps(),
          createAdapter: () => badAdapter
        }
      )
    ).rejects.toThrow("gateway down");

    expect(emitN8nMock).not.toHaveBeenCalled();
  });

  it("nao emite quando charge_not_found", async () => {
    state.charge = null;

    await expect(processPaymentEmission({ chargeId, tenantId }, deps())).rejects.toSatisfy(
      (e: unknown) => e instanceof UnrecoverableError && e.message === "charge_not_found"
    );

    expect(emitN8nMock).not.toHaveBeenCalled();
  });
});
