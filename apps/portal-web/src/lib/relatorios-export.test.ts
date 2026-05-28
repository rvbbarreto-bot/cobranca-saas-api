import { describe, expect, it } from "vitest";
import { defaultExportDateRange, validateExportDateRange } from "./relatorios-export";

describe("relatorios-export", () => {
  it("defaultExportDateRange retorna 30 dias inclusive", () => {
    const { from, to } = defaultExportDateRange(new Date("2026-05-28T12:00:00"));
    expect(to).toBe("2026-05-28");
    expect(from).toBe("2026-04-29");
  });

  it("validateExportDateRange rejeita intervalo invertido", () => {
    expect(validateExportDateRange("2026-06-01", "2026-05-01")).toMatch(/inicial/);
  });

  it("validateExportDateRange aceita intervalo valido", () => {
    expect(validateExportDateRange("2026-05-01", "2026-05-28")).toBeNull();
  });
});
