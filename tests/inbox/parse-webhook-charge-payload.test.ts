import { describe, expect, it } from "vitest";
import { parseWebhookChargePayload } from "../../src/modules/inbox/application/parse-webhook-charge-payload";

describe("parseWebhookChargePayload", () => {
  it("aceita payload plano com reference", () => {
    const r = parseWebhookChargePayload({
      canonical_status: "paga",
      reference: "PEDIDO-42"
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.canonicalStatus).toBe("paga");
      expect(r.value.reference).toBe("PEDIDO-42");
    }
  });

  it("aceita provider_charge_id", () => {
    const r = parseWebhookChargePayload({
      canonical_status: "vencida",
      provider_charge_id: "prov-99"
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.providerChargeId).toBe("prov-99");
    }
  });

  it("desembrulha objeto charge", () => {
    const r = parseWebhookChargePayload({
      charge: { canonical_status: "pendente_pagamento", reference: "A" }
    });
    expect(r.ok).toBe(true);
  });

  it("desembrulha data", () => {
    const r = parseWebhookChargePayload({
      data: { canonical_status: "cancelada", reference: "X1" }
    });
    expect(r.ok).toBe(true);
  });

  it("rejeita sem referencia nem provider", () => {
    const r = parseWebhookChargePayload({ canonical_status: "paga" });
    expect(r.ok).toBe(false);
  });

  it("rejeita status invalido", () => {
    const r = parseWebhookChargePayload({
      canonical_status: "liquidado",
      reference: "R"
    });
    expect(r.ok).toBe(false);
  });
});
