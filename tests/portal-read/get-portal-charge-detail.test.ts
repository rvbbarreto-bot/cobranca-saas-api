import { describe, expect, it, vi } from "vitest";
import type { PoolClient } from "pg";
import { getPortalChargeDetailUseCase } from "../../src/modules/portal-read/application/get-portal-charge-detail";

const tenantId = "00000000-0000-4000-8000-000000000001";
const chargeId = "10000000-0000-4000-8000-000000000099";

describe("getPortalChargeDetailUseCase", () => {
  it("retorna charge com payment pix quando houver transacao", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            id: chargeId,
            tenant_id: tenantId,
            reference: "REF-1",
            idempotency_key: "idem-12345678",
            amount: "99.90",
            due_date: "2030-12-01",
            type: "pix",
            canonical_status: "emitida",
            provider: null,
            provider_charge_id: null,
            metadata: {},
            created_at: new Date("2026-01-01T00:00:00.000Z"),
            updated_at: new Date("2026-01-01T00:00:00.000Z"),
            payment_type: "pix",
            payment_status: "pending",
            boleto_url: null,
            boleto_pdf_url: null,
            boleto_barcode: null,
            pix_qrcode_base64: "base64img",
            pix_emv: "00020126",
            pix_link: "https://pix",
            payment_expires_at: new Date("2030-12-01T23:59:59.000Z")
          }
        ]
      })
      .mockResolvedValueOnce({ rows: [] });
    const client = { query } as unknown as PoolClient;

    const out = await getPortalChargeDetailUseCase(client, chargeId, tenantId);
    expect(out).not.toBeNull();
    expect(out!.charge.canonicalStatus).toBe("emitida");
    expect(out!.payment).toEqual({
      type: "pix",
      boleto_url: null,
      boleto_pdf_url: null,
      boleto_barcode: null,
      pix_qrcode_base64: "base64img",
      pix_emv: "00020126",
      pix_link: "https://pix",
      expires_at: "2030-12-01T23:59:59.000Z"
    });
  });

  it("retorna payment null quando cobranca ainda em rascunho sem transacao", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [
          {
            id: chargeId,
            tenant_id: tenantId,
            reference: "REF-1",
            idempotency_key: "idem-12345678",
            amount: "10.00",
            due_date: "2030-12-01",
            type: "boleto",
            canonical_status: "rascunho",
            provider: null,
            provider_charge_id: null,
            metadata: {},
            created_at: new Date("2026-01-01T00:00:00.000Z"),
            updated_at: new Date("2026-01-01T00:00:00.000Z"),
            payment_type: null,
            payment_status: null,
            boleto_url: null,
            boleto_pdf_url: null,
            boleto_barcode: null,
            pix_qrcode_base64: null,
            pix_emv: null,
            pix_link: null,
            payment_expires_at: null
          }
        ]
      })
      .mockResolvedValueOnce({ rows: [] });
    const client = { query } as unknown as PoolClient;

    const out = await getPortalChargeDetailUseCase(client, chargeId, tenantId);
    expect(out!.payment).toBeNull();
  });

  it("retorna null quando cobranca nao existe no tenant", async () => {
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [] })
    } as unknown as PoolClient;

    const out = await getPortalChargeDetailUseCase(client, chargeId, tenantId);
    expect(out).toBeNull();
  });
});
