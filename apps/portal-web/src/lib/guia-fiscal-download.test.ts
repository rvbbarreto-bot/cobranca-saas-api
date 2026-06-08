import { describe, expect, it } from "vitest";
import {
  canDownloadGuiaPdf,
  guiaPdfDownloadFilename,
  guiaPdfDownloadLabel,
  resolveProcessamentoIdForGuia
} from "./guia-fiscal-download";

describe("guia-fiscal-download", () => {
  it("bloqueia download em PROCESSANDO e CANCELADO", () => {
    expect(canDownloadGuiaPdf("DISPONIVEL")).toBe(true);
    expect(canDownloadGuiaPdf("PROCESSANDO")).toBe(false);
    expect(canDownloadGuiaPdf("CANCELADO")).toBe(false);
  });

  it("monta nome de arquivo por tipo e competência", () => {
    expect(
      guiaPdfDownloadFilename({ id: "g1", tipo_guia: "DAS", competencia: "2026-05" })
    ).toBe("DAS-2026-05.pdf");
  });

  it("rótulo amigável para DAS", () => {
    expect(guiaPdfDownloadLabel({ tipo_guia: "DAS" })).toMatch(/DAS/i);
    expect(guiaPdfDownloadLabel({ tipo_guia: "DARF" })).toMatch(/PDF/i);
  });

  it("prioriza processamento vindo de state/query", () => {
    expect(
      resolveProcessamentoIdForGuia({
        stateProcessamentoId: "p-state",
        queryProcessamentoId: "p-query",
        processamentoFromList: { id: "p-list" }
      })
    ).toBe("p-state");
    expect(
      resolveProcessamentoIdForGuia({
        queryProcessamentoId: "p-query",
        processamentoFromList: { id: "p-list" }
      })
    ).toBe("p-query");
    expect(
      resolveProcessamentoIdForGuia({
        processamentoFromList: { id: "p-list" }
      })
    ).toBe("p-list");
  });
});
