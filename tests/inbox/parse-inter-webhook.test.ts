import { describe, expect, it } from "vitest";
import { parseInterWebhook, isLikelyInterWebhook } from "../../src/modules/inbox/application/parse-inter-webhook";
import { parseWebhookChargeInstruction } from "../../src/modules/inbox/application/parse-webhook-charge-instruction";

describe("parseInterWebhook", () => {
  it("mapeia situacao PAGO para paga", () => {
    const payload = {
      codigoSolicitacao: "cod-1",
      seuNumero: "REF-1",
      situacao: "PAGO"
    };
    expect(isLikelyInterWebhook(payload)).toBe(true);
    const parsed = parseInterWebhook(payload);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.canonicalStatus).toBe("paga");
      expect(parsed.value.providerChargeId).toBe("cod-1");
      expect(parsed.value.reference).toBe("REF-1");
    }
  });

  it("integra com parseWebhookChargeInstruction", () => {
    const result = parseWebhookChargeInstruction({
      codigoSolicitacao: "cod-2",
      situacao: "VENCIDO"
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.format).toBe("inter");
      expect(result.value.canonicalStatus).toBe("vencida");
    }
  });
});
