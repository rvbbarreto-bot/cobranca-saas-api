import { describe, expect, it, vi, beforeEach } from "vitest";
import { UnrecoverableError } from "bullmq";
import type { PoolClient } from "pg";
import type { PaymentGatewayAdapter } from "../../../src/modules/payment-gateway/domain/payment-gateway.interface";
import {
  handlePaymentEmissionFailure,
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
    reference: "REF-1",
    idempotencyKey: "idem-12345678",
    amount: "150.00",
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
  chargeStatus: string;
  events: Array<Record<string, unknown>>;
  lastPaymentInsert: Record<string, unknown> | null;
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
        state.lastPaymentInsert = {
          pix_qrcode_base64: params?.[9],
          type: params?.[4]
        };
        return { rowCount: 1, rows: [] };
      }

      if (q.startsWith("update charges") && q.includes("emitida")) {
        state.chargeStatus = "emitida";
        if (state.charge) {
          state.charge = { ...state.charge, canonicalStatus: "emitida" };
        }
        return { rowCount: 1, rows: [] };
      }

      if (q.startsWith("update charges") && q.includes("erro_emissao")) {
        state.chargeStatus = "erro_emissao";
        return { rowCount: 1, rows: [] };
      }

      if (q.startsWith("insert into charge_events")) {
        state.events.push({
          event_type: params?.[2],
          old_status: params?.[3],
          new_status: params?.[4],
          payload_json: params?.[5]
        });
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
    createPix: vi.fn().mockResolvedValue({
      gatewayTransactionId: "pay_pix_1",
      pixQrcodeBase64: "img-base64",
      pixEmv: "emv",
      pixLink: "https://pix",
      expiresAt: new Date("2030-06-15T23:59:59.999Z")
    }),
    cancelCharge: vi.fn(),
    getCharge: vi.fn(),
    ...overrides
  };
}

describe("processPaymentEmission", () => {
  let state: MockState;
  let adapter: PaymentGatewayAdapter;

  beforeEach(() => {
    state = {
      charge: baseCharge(),
      cliente: {
        id: clienteId,
        tenant_id: automacaoTenantId,
        documento: "12345678909",
        nome: "Cliente Teste",
        email: "c@test.com",
        telefone: null,
        gateway_customer_id: "cus_existing"
      },
      chargeStatus: "rascunho",
      events: [],
      lastPaymentInsert: null
    };
    adapter = createAdapterMock();
  });

  const deps = () => ({
    withTenant: async (_tid: string, fn: (c: PoolClient) => Promise<void>) => fn(createMockClient(state)),
    createAdapter: () => adapter,
    decryptApiKey: () => "asaas_key_test"
  });

  it("boleto emitido → canonical_status emitida e payment_transactions criado", async () => {
    await processPaymentEmission({ chargeId, tenantId }, deps());
    expect(state.chargeStatus).toBe("emitida");
    expect(adapter.createBoleto).toHaveBeenCalled();
    expect(state.lastPaymentInsert).toEqual({ pix_qrcode_base64: null, type: "boleto" });
    expect(
      state.events.some((e) => e.event_type === "emissao_gateway" && e.new_status === "emitida")
    ).toBe(true);
  });

  it("pix emitido → pix_qrcode_base64 salvo e canonical_status emitida", async () => {
    state.charge = baseCharge({ type: "pix" });
    await processPaymentEmission({ chargeId, tenantId }, deps());
    expect(state.chargeStatus).toBe("emitida");
    expect(adapter.createPix).toHaveBeenCalled();
    expect(state.lastPaymentInsert).toEqual({ pix_qrcode_base64: "img-base64", type: "pix" });
  });

  it("cliente sem gateway_customer_id → createCustomer chamado antes", async () => {
    state.cliente.gateway_customer_id = null;
    await processPaymentEmission({ chargeId, tenantId }, deps());
    expect(adapter.createCustomer).toHaveBeenCalled();
    expect(state.cliente.gateway_customer_id).toBe("cus_asaas_1");
    expect(state.chargeStatus).toBe("emitida");
  });

  it("cliente com gateway_customer_id → createCustomer NAO chamado", async () => {
    state.cliente.gateway_customer_id = "cus_existing";
    await processPaymentEmission({ chargeId, tenantId }, deps());
    expect(adapter.createCustomer).not.toHaveBeenCalled();
    expect(state.chargeStatus).toBe("emitida");
  });

  it("adapter lança erro → erro_emissao após falha permanente", async () => {
    adapter = createAdapterMock({
      createBoleto: vi.fn().mockRejectedValue(new Error("Asaas indisponivel"))
    });
    await expect(processPaymentEmission({ chargeId, tenantId }, deps())).rejects.toThrow(
      "Asaas indisponivel"
    );
    await handlePaymentEmissionFailure({ chargeId, tenantId }, new Error("Asaas indisponivel"), deps());
    expect(state.chargeStatus).toBe("erro_emissao");
    expect(state.events.some((e) => e.event_type === "erro_emissao")).toBe(true);
  });

  it("charge de outro tenant → charge_not_found sem processar", async () => {
    await expect(
      processPaymentEmission(
        { chargeId, tenantId: "00000000-0000-4000-8000-000000000002" },
        deps()
      )
    ).rejects.toSatisfy(
      (e: unknown) => e instanceof UnrecoverableError && e.message === "charge_not_found"
    );
    expect(state.chargeStatus).toBe("rascunho");
    expect(adapter.createBoleto).not.toHaveBeenCalled();
  });
});
