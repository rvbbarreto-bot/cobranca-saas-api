import { describe, expect, it } from "vitest";
import { handleFiscalCaptureInboxPayload, tryParseFiscalCaptureInboxPayload } from "../../src/modules/fiscal-guias/application/handle-fiscal-capture-inbox";

describe("tryParseFiscalCaptureInboxPayload", () => {
  it("ignora payload sem event_type fiscal", () => {
    expect(tryParseFiscalCaptureInboxPayload({ event_type: "charge.paid" })).toBeNull();
  });

  it("parseia evento fiscal DAS valido", () => {
    const p = tryParseFiscalCaptureInboxPayload({
      event_type: "fiscal.capture.requested",
      portal_cliente_id: "550e8400-e29b-41d4-a716-446655440000",
      tipo_guia: "DAS",
      competencia: "2026-05",
      idempotency_key: "idem-test-01"
    });
    expect(p?.tipo_guia).toBe("DAS");
  });

  it("parseia evento fiscal DARF com campos obrigatorios", () => {
    const p = tryParseFiscalCaptureInboxPayload({
      event_type: "fiscal.capture.requested",
      portal_cliente_id: "550e8400-e29b-41d4-a716-446655440000",
      tipo_guia: "DARF",
      competencia: "2026-06",
      codigo_receita: "0561",
      periodo_apuracao: "2026-06-30",
      idempotency_key: "idem-darf-01"
    });
    expect(p?.tipo_guia).toBe("DARF");
    expect(p?.codigo_receita).toBe("0561");
  });

  it("retorna null para DARF incompleto", () => {
    expect(
      tryParseFiscalCaptureInboxPayload({
        event_type: "fiscal.capture.requested",
        portal_cliente_id: "550e8400-e29b-41d4-a716-446655440000",
        tipo_guia: "DARF",
        competencia: "2026-06",
        idempotency_key: "idem-darf-invalid"
      })
    ).toBeNull();
  });
});

describe("handleFiscalCaptureInboxPayload", () => {
  it("retorna not_fiscal para payload de cobranca", async () => {
    const client = { query: async () => ({ rows: [] }) };
    const r = await handleFiscalCaptureInboxPayload(
      "00000000-0000-4000-8000-000000000001",
      { canonical_status: "paga" },
      client as never
    );
    expect(r.kind).toBe("not_fiscal");
  });
});
