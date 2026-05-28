import { describe, expect, it } from "vitest";
import {
  isValidIsoDateOnly,
  parseCobrancaExportQuery
} from "../../src/modules/portal-read/application/escritorio-export-date-params";

describe("escritorio-export-date-params", () => {
  it("isValidIsoDateOnly rejeita datas invalidas", () => {
    expect(isValidIsoDateOnly("2026-02-30")).toBe(false);
    expect(isValidIsoDateOnly("abc")).toBe(false);
    expect(isValidIsoDateOnly("2026-05-01")).toBe(true);
  });

  it("parseCobrancaExportQuery aceita from/to", () => {
    const r = parseCobrancaExportQuery({ from: "2026-05-01", to: "2026-05-28" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.filters.dataInicio).toBe("2026-05-01");
      expect(r.filters.dataFim).toBe("2026-05-28");
    }
  });

  it("parseCobrancaExportQuery mantem alias data_inicio/data_fim", () => {
    const r = parseCobrancaExportQuery({ data_inicio: "2026-01-01", data_fim: "2026-01-31" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.filters.dataInicio).toBe("2026-01-01");
      expect(r.filters.dataFim).toBe("2026-01-31");
    }
  });

  it("from tem precedencia sobre data_inicio", () => {
    const r = parseCobrancaExportQuery({
      from: "2026-06-01",
      data_inicio: "2026-01-01",
      to: "2026-06-30"
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.filters.dataInicio).toBe("2026-06-01");
    }
  });

  it("rejeita intervalo invertido", () => {
    const r = parseCobrancaExportQuery({ from: "2026-06-01", to: "2026-05-01" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("invalid_date_range");
    }
  });

  it("rejeita from invalido", () => {
    const r = parseCobrancaExportQuery({ from: "01-05-2026", to: "2026-05-28" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("invalid_from");
    }
  });
});
