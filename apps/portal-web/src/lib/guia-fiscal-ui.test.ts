import { describe, expect, it } from "vitest";
import {
  buildGuiasFiscaisListQuery,
  guiaFiscalComplianceLabel,
  guiaFiscalStatusLabel,
  isValidCompetenciaFilter,
  tipoGuiaLabel
} from "./guia-fiscal-ui";

describe("guia-fiscal-ui", () => {
  it("rotula tipo DAS e DARF", () => {
    expect(tipoGuiaLabel("DAS")).toContain("Simples");
    expect(tipoGuiaLabel("DARF")).toContain("Receitas");
  });

  it("rotula status fiscal em portugues", () => {
    expect(guiaFiscalStatusLabel("DISPONIVEL")).toBe("Disponível");
    expect(guiaFiscalStatusLabel("PAGO")).toBe("Paga");
  });

  it("rotula compliance", () => {
    expect(guiaFiscalComplianceLabel("aprovado")).toBe("Aprovado");
    expect(guiaFiscalComplianceLabel("bloqueado")).toBe("Bloqueado");
  });

  it("valida competencia YYYY-MM", () => {
    expect(isValidCompetenciaFilter("2026-06")).toBe(true);
    expect(isValidCompetenciaFilter("2026-13")).toBe(false);
    expect(isValidCompetenciaFilter("")).toBe(true);
  });

  it("monta query com tipo e competencia", () => {
    const q = buildGuiasFiscaisListQuery({
      limit: 50,
      tipoGuia: "DARF",
      competencia: "2026-06"
    });
    expect(q.tipo_guia).toBe("DARF");
    expect(q.competencia).toBe("2026-06");
    expect(q.limit).toBe(50);
  });

  it("ignora tipo vazio na query", () => {
    const q = buildGuiasFiscaisListQuery({ limit: 25, tipoGuia: "" });
    expect(q.tipo_guia).toBeUndefined();
  });
});
