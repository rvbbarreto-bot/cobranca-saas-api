import { describe, expect, it, vi } from "vitest";
import {
  clienteOwnsCharge,
  getClienteCobrancaDetail,
  listClienteCobrancas
} from "../../src/modules/portal-read/application/cliente-portal-cobrancas";

const publicTenantId = "00000000-0000-4000-8000-000000000001";
const clienteId = "20000000-0000-4000-8000-000000000002";
const otherClienteId = "30000000-0000-4000-8000-000000000003";
const chargeId = "10000000-0000-4000-8000-000000000099";

describe("cliente portal cobrancas", () => {
  it("listClienteCobrancas restringe ao cliente autenticado (customer_id / portal_cliente_id)", async () => {
    const query = vi.fn(async () => ({ rows: [] }));
    const client = { query };
    await listClienteCobrancas(client as never, publicTenantId, clienteId, {
      page: 1,
      limit: 20
    });

    const sql = String(query.mock.calls[0]?.[0] ?? "");
    expect(sql).toContain("customer_id");
    expect(sql).toContain("portal_cliente_id");
    expect(query.mock.calls[0]?.[1]).toEqual(
      expect.arrayContaining([publicTenantId, clienteId, 20, 0])
    );
  });

  it("listClienteCobrancas com status=paga filtra canonical_status", async () => {
    const query = vi.fn(async () => ({ rows: [] }));
    const client = { query };
    await listClienteCobrancas(client as never, publicTenantId, clienteId, {
      status: "paga",
      page: 1,
      limit: 20
    });

    const sql = String(query.mock.calls[0]?.[0] ?? "");
    expect(sql).toContain("canonical_status = $5");
    expect(query.mock.calls[0]?.[1]).toEqual(
      expect.arrayContaining([publicTenantId, clienteId, 20, 0, "paga"])
    );
  });

  it("listClienteCobrancas retorna apenas campos seguros", async () => {
    const query = vi.fn(async () => ({
      rows: [
        {
          id: chargeId,
          canonical_status: "pendente_pagamento",
          amount: "150.00",
          due_date: "2026-06-01",
          description: "Mensalidade",
          type: "boleto",
          payment_type: "boleto",
          boleto_url: "https://boleto.test/1",
          pix_qrcode_base64: null,
          pix_emv: null,
          expires_at: null
        }
      ]
    }));

    const client = { query };
    const data = await listClienteCobrancas(client as never, publicTenantId, clienteId, {
      page: 1,
      limit: 20
    });

    expect(data).toEqual([
      {
        id: chargeId,
        canonical_status: "pendente_pagamento",
        amount: "150.00",
        due_date: "2026-06-01",
        description: "Mensalidade",
        type: "boleto",
        payment: {
          type: "boleto",
          boleto_url: "https://boleto.test/1",
          pix_qrcode_base64: null,
          pix_emv: null,
          expires_at: null
        }
      }
    ]);
    expect(data[0]).not.toHaveProperty("metadata");
    expect(data[0]).not.toHaveProperty("nfse");
  });

  it("clienteOwnsCharge false para cobrança de outro cliente", async () => {
    const query = vi.fn(async () => ({ rowCount: 0 }));
    const owns = await clienteOwnsCharge(
      { query } as never,
      publicTenantId,
      chargeId,
      otherClienteId
    );
    expect(owns).toBe(false);
  });

  it("getClienteCobrancaDetail inclui events sem payload_json", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("charge_events")) {
        return {
          rows: [
            {
              event_type: "status_changed",
              old_status: "emitida",
              new_status: "pendente_pagamento",
              created_at: new Date("2026-05-01T12:00:00.000Z")
            }
          ]
        };
      }
      return {
        rows: [
          {
            id: chargeId,
            canonical_status: "pendente_pagamento",
            amount: "100.00",
            due_date: "2026-06-01",
            description: "Ref",
            type: "pix",
            payment_type: "pix",
            boleto_url: null,
            pix_qrcode_base64: "abc",
            pix_emv: "emv",
            expires_at: null
          }
        ]
      };
    });

    const detail = await getClienteCobrancaDetail(
      { query } as never,
      publicTenantId,
      chargeId,
      clienteId
    );

    expect(detail?.events).toEqual([
      {
        event_type: "status_changed",
        old_status: "emitida",
        new_status: "pendente_pagamento",
        created_at: "2026-05-01T12:00:00.000Z"
      }
    ]);
    expect(detail?.events[0]).not.toHaveProperty("payload_json");
  });
});
