import { describe, expect, it } from "vitest";
import {
  filterProcessamentoRows,
  formatProcessamentoEventoLabel,
  getTransmissionStepStates,
  groupProcessamentosByErro,
  processamentoErroHelp,
  processamentoErroSuggestedAction,
  processamentoLiveUserMessage,
  processamentoTemErro,
  shouldPollProcessamentoDetail
} from "./processamento-fiscal-ui";

const sampleRows = [
  {
    id: "p1",
    portal_cliente_id: "c1",
    competencia: "2026-05",
    status: "ERRO",
    erro_codigo: "PROCURACAO_INVALIDA"
  },
  {
    id: "p2",
    portal_cliente_id: "c1",
    competencia: "2026-04",
    status: "CONCLUIDO",
    erro_codigo: null
  },
  {
    id: "p3",
    portal_cliente_id: "c2",
    competencia: "2026-05",
    status: "ERRO",
    erro_codigo: "PROCURACAO_INVALIDA"
  },
  {
    id: "p4",
    portal_cliente_id: "c2",
    competencia: "2026-05",
    status: "CONCLUIDO",
    erro_codigo: "DAS_FALHOU"
  }
];

describe("processamento-fiscal-ui (EXEQ-FISC-073)", () => {
  it("poll enquanto pipeline em andamento", () => {
    expect(shouldPollProcessamentoDetail("TRANSMITINDO")).toBe(true);
    expect(shouldPollProcessamentoDetail("CONCLUIDO")).toBe(false);
    expect(shouldPollProcessamentoDetail("ERRO")).toBe(false);
  });

  it("mensagens amigáveis por status", () => {
    expect(processamentoLiveUserMessage("TRANSMITINDO")).toContain("Receita");
    expect(processamentoLiveUserMessage("CONCLUIDO")).toContain("concluído");
  });

  it("stepper marca etapa ativa e concluídas", () => {
    const states = getTransmissionStepStates({ status: "RECIBO_OK" });
    expect(states.filter((s) => s === "done").length).toBeGreaterThanOrEqual(3);
    expect(states.some((s) => s === "active" || s === "done")).toBe(true);
  });

  it("stepper marca erro na etapa correta", () => {
    const states = getTransmissionStepStates({
      status: "ERRO",
      protocolo_serpro: null
    });
    expect(states[1]).toBe("error");
    expect(states[0]).toBe("done");
  });

  it("ajuda para procuração inválida", () => {
    expect(processamentoErroHelp("PROCURACAO_INVALIDA").sugestao).toContain("e-CAC");
  });

  it("rótulos de eventos legíveis", () => {
    expect(formatProcessamentoEventoLabel("transmissao_concluida")).toContain("transmitida");
  });
});

describe("processamento-fiscal-ui (EXEQ-FISC-074)", () => {
  it("filtra por competência, empresa, status e erro", () => {
    expect(filterProcessamentoRows(sampleRows, { competencia: "2026-05" })).toHaveLength(3);
    expect(filterProcessamentoRows(sampleRows, { portalClienteId: "c2" })).toHaveLength(2);
    expect(filterProcessamentoRows(sampleRows, { status: "CONCLUIDO" })).toHaveLength(2);
    expect(filterProcessamentoRows(sampleRows, { somenteComErro: true })).toHaveLength(3);
  });

  it("agrupa erros por código com título traduzido", () => {
    const groups = groupProcessamentosByErro(sampleRows);
    expect(groups).toHaveLength(2);
    const procuracao = groups.find((g) => g.codigo === "PROCURACAO_INVALIDA");
    expect(procuracao?.count).toBe(2);
    expect(procuracao?.titulo).toContain("Procuração");
    expect(procuracao?.sugestao).toContain("e-CAC");
  });

  it("detecta erro parcial com código em status concluído", () => {
    expect(processamentoTemErro(sampleRows[3]!)).toBe(true);
  });

  it("sugere ação config fiscal para procuração", () => {
    expect(processamentoErroSuggestedAction("PROCURACAO_INVALIDA")?.to).toBe("/fiscal/procuracoes");
  });

  it("traduz DAS_FALHOU", () => {
    expect(processamentoErroHelp("DAS_FALHOU").titulo).toContain("DAS");
  });
});
