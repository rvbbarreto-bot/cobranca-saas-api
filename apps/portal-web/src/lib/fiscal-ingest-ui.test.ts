import { describe, expect, it } from "vitest";
import {
  canStartTransmissionFromIngest,
  fiscalIngestStatusLabel,
  formatIngestLineError,
  isCsvFile,
  shouldPollFiscalIngest
} from "./fiscal-ingest-ui";

describe("fiscal-ingest-ui", () => {
  it("poll apenas em VALIDANDO", () => {
    expect(shouldPollFiscalIngest("VALIDANDO")).toBe(true);
    expect(shouldPollFiscalIngest("VALIDADO")).toBe(false);
    expect(shouldPollFiscalIngest("ERRO")).toBe(false);
  });

  it("transmissão só após VALIDADO", () => {
    expect(canStartTransmissionFromIngest("VALIDADO")).toBe(true);
    expect(canStartTransmissionFromIngest("ERRO")).toBe(false);
  });

  it("formata erro de linha", () => {
    expect(
      formatIngestLineError({
        linha: 2,
        campo: "cnpj",
        codigo: "CNPJ_INVALIDO",
        mensagem: "CNPJ inválido"
      })
    ).toContain("Linha 2");
  });

  it("aceita arquivo csv", () => {
    expect(isCsvFile(new File(["a"], "test.csv", { type: "text/csv" }))).toBe(true);
    expect(isCsvFile(new File(["a"], "test.txt", { type: "text/plain" }))).toBe(false);
  });

  it("rótulos de status", () => {
    expect(fiscalIngestStatusLabel("VALIDANDO")).toContain("Validando");
  });
});
