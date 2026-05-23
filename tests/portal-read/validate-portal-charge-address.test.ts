import { describe, expect, it, vi } from "vitest";
import type { PoolClient } from "pg";
import { assertPortalChargeCreateAllowed } from "../../src/modules/portal-read/application/validate-portal-charge-create";

describe("assertPortalChargeCreateAllowed — endereco pagador", () => {
  it("rejeita cobranca Inter quando cliente sem endereco completo", async () => {
    const clienteId = "20000000-0000-4000-8000-000000000099";
    const client = {
      query: vi.fn(async (sql: string) => {
        const q = String(sql).replace(/\s+/g, " ").toLowerCase();
        if (q.includes("gateway_provider")) {
          return { rows: [{ gateway_provider: "inter" }] };
        }
        if (q.includes("portal.cliente") && q.includes("endereco_cep")) {
          return {
            rows: [
              {
                endereco_cep: null,
                endereco_logradouro: null,
                endereco_numero: null,
                endereco_complemento: null,
                endereco_bairro: null,
                endereco_cidade: null,
                endereco_uf: null
              }
            ]
          };
        }
        return { rows: [] };
      })
    } as unknown as PoolClient;

    await expect(
      assertPortalChargeCreateAllowed(client, "tenant-automacao", {
        reference: "REF-TEST",
        amount: 100,
        due_date: "2099-06-01",
        portal_cliente_id: clienteId
      })
    ).rejects.toMatchObject({ message: "PORTAL_CLIENTE_ADDRESS_REQUIRED" });
  });
});
