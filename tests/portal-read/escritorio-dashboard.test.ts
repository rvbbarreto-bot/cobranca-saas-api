import { describe, expect, it } from "vitest";
import { resolveDashboardPeriod } from "../../src/modules/portal-read/application/escritorio-dashboard";

describe("resolveDashboardPeriod", () => {
  it("periodo 7d calcula inicio relativo ao fim", () => {
    const p = resolveDashboardPeriod({ periodo: "7d", dataFim: "2026-05-18" });
    expect(p.fim).toBe("2026-05-18");
    expect(p.inicio).toBe("2026-05-12");
  });

  it("custom usa datas informadas", () => {
    const p = resolveDashboardPeriod({
      periodo: "custom",
      dataInicio: "2026-01-01",
      dataFim: "2026-01-31"
    });
    expect(p.inicio).toBe("2026-01-01");
    expect(p.fim).toBe("2026-01-31");
  });
});
