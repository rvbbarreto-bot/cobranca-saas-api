import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseInterWebhook, isLikelyInterWebhook } from "../../src/modules/inbox/application/parse-inter-webhook";
import { parseWebhookChargeInstruction } from "../../src/modules/inbox/application/parse-webhook-charge-instruction";

function loadFixture(name: string): unknown {
  const raw = readFileSync(join(process.cwd(), "tests", "fixtures", name), "utf8");
  return JSON.parse(raw) as unknown;
}

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

  it("parse fixtures JSON inter-webhook-pago e vencido", () => {
    const pago = loadFixture("inter-webhook-pago.json");
    const vencido = loadFixture("inter-webhook-vencido.json");
    const pagoParsed = parseInterWebhook(pago);
    const vencidoParsed = parseInterWebhook(vencido);
    expect(pagoParsed.ok).toBe(true);
    expect(vencidoParsed.ok).toBe(true);
    if (pagoParsed.ok && vencidoParsed.ok) {
      expect(pagoParsed.value.canonicalStatus).toBe("paga");
      expect(vencidoParsed.value.canonicalStatus).toBe("vencida");
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
