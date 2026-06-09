import { describe, expect, it } from "vitest";
import { FISCAL_AUDIT_ACTIONS } from "../../src/modules/fiscal-guias/domain/schemas/fiscal-audit.schema";

describe("FISC-053 — fiscal audit apuração SERPRO actions", () => {
  it("expõe apuracao_iniciada, transmitida e erro_serpro no schema portal", () => {
    expect(FISCAL_AUDIT_ACTIONS).toContain("apuracao_iniciada");
    expect(FISCAL_AUDIT_ACTIONS).toContain("transmitida");
    expect(FISCAL_AUDIT_ACTIONS).toContain("erro_serpro");
  });
});
