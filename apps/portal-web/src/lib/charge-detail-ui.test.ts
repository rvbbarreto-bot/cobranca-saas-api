import { describe, expect, it } from "vitest";
import { resolveChargeDetailBanners } from "./charge-detail-ui";
import type { ChargeEventRow } from "./charge-detail-timeline";

const baseEvents: ChargeEventRow[] = [
  {
    event_type: "charge.created",
    old_status: null,
    new_status: "rascunho",
    created_at: "2026-05-28T22:11:00.000Z"
  },
  {
    event_type: "erro_emissao",
    old_status: "rascunho",
    new_status: "erro_emissao",
    created_at: "2026-05-28T22:18:00.000Z",
    payload_json: { error: "portal_cliente_address_required_for_emission" }
  },
  {
    event_type: "emission.reprocess",
    old_status: "erro_emissao",
    new_status: "rascunho",
    created_at: "2026-05-28T23:09:00.000Z"
  }
];

describe("resolveChargeDetailBanners", () => {
  it("apos reprocesso em rascunho: so em andamento, sem erro antigo", () => {
    const b = resolveChargeDetailBanners({
      events: baseEvents,
      chargeStatus: "rascunho",
      isPolling: true,
      timeoutReached: false,
      hasPayment: false
    });
    expect(b.emissionError).toBeNull();
    expect(b.showEmissionProgress).toBe(true);
    expect(b.showEmissionInconclusive).toBe(false);
  });

  it("apos timeout em rascunho: inconclusivo sem erro antigo nem andamento", () => {
    const b = resolveChargeDetailBanners({
      events: baseEvents,
      chargeStatus: "rascunho",
      isPolling: false,
      timeoutReached: true,
      hasPayment: false
    });
    expect(b.emissionError).toBeNull();
    expect(b.showEmissionProgress).toBe(false);
    expect(b.showEmissionInconclusive).toBe(true);
  });

  it("em erro_emissao: exibe falha amigavel, sem andamento", () => {
    const b = resolveChargeDetailBanners({
      events: baseEvents,
      chargeStatus: "erro_emissao",
      isPolling: false,
      timeoutReached: false,
      hasPayment: false
    });
    expect(b.emissionError).toMatch(/endereço completo/i);
    expect(b.showEmissionProgress).toBe(false);
    expect(b.showEmissionInconclusive).toBe(false);
  });
});
