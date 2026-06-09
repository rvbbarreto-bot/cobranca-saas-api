import { describe, expect, it } from "vitest";
import {
  getPortalChargeRules,
  isDueDateAllowed,
  minDueDateIso,
  sanitizeChargeReference
} from "../../src/modules/portal-read/application/portal-charge-rules";

describe("getPortalChargeRules", () => {
  it("Inter limita referencia a 80 alfanumerico e exige pagador", () => {
    const r = getPortalChargeRules("inter");
    expect(r.referenceMaxLength).toBe(80);
    expect(r.referenceAlphanumericOnly).toBe(true);
    expect(r.requiresPayer).toBe(true);
    expect(r.supportsPix).toBe(false);
  });

  it("Asaas permite D+0", () => {
    const r = getPortalChargeRules("asaas");
    expect(r.minDueOffsetDays).toBe(0);
    expect(r.requiresPayer).toBe(false);
  });
});

describe("sanitizeChargeReference", () => {
  it("remove especiais para Inter", () => {
    const rules = getPortalChargeRules("inter");
    expect(sanitizeChargeReference("NF-123 @#$", rules)).toBe("NF123");
  });
});

describe("isDueDateAllowed", () => {
  const today = new Date(2026, 4, 21);

  it("rejeita data passada para qualquer gateway", () => {
    const rules = getPortalChargeRules("asaas");
    expect(isDueDateAllowed("2020-01-01", rules, today)).toBe(false);
  });

  it("Inter exige vencimento apos D+1 util", () => {
    const rules = getPortalChargeRules("inter");
    const min = minDueDateIso(rules, today);
    expect(isDueDateAllowed(min, rules, today)).toBe(true);
    expect(isDueDateAllowed("2026-05-21", rules, today)).toBe(false);
  });

  it("aceita hoje mesmo quando o instante atual seria D+1 em UTC (fronteira 21h BRT)", () => {
    // Simula 21:40 BRT = 00:40 UTC do dia seguinte.
    // O today passado deve ser o dia CALENDÁRIO brasileiro (2026-05-28),
    // não o dia UTC (2026-05-29), para não rejeitar a data de hoje.
    const todayBrazil = new Date(2026, 4, 28); // 2026-05-28 midnight local
    const rules = getPortalChargeRules("asaas");
    expect(isDueDateAllowed("2026-05-28", rules, todayBrazil)).toBe(true);
  });
});
