import { describe, expect, it } from "vitest";
import {
  buildClienteFiscalIndicators,
  expiringCertificatesByCliente,
  formatCompetenciaShort,
  indexLatestProcessamentosByCliente,
  novaApuracaoImportHref,
  resolveCertificadoIndicator,
  resolveProcessamentoIndicator,
  resolveProcuracaoIndicator
} from "./cliente-fiscal-indicators";
import type { CertificadoDigitalRow, ProcessamentoFiscalRow, ProcuracaoRow } from "./api";

const cert: CertificadoDigitalRow = {
  id: "cert-1",
  portal_cliente_id: "c1",
  label: "A1",
  valid_from: "2026-01-01",
  valid_until: "2027-01-01",
  ativo: true,
  created_at: "",
  updated_at: ""
};

const procuracaoValida: ProcuracaoRow = {
  id: "p1",
  portal_cliente_id: "c1",
  tipo: "ecac",
  procurador_documento: "123",
  validade_inicio: "2026-01-01",
  validade_fim: "2027-01-01",
  ativa: true,
  metadata: { serpro_situacao: "valida" },
  created_at: "",
  updated_at: ""
};

const procConcluido: ProcessamentoFiscalRow = {
  id: "proc-1",
  portal_cliente_id: "c1",
  fiscal_ingest_id: "ing1",
  competencia: "2026-05",
  tipo: "PGDASD",
  status: "CONCLUIDO",
  valor_apurado: "100",
  protocolo_serpro: "123",
  recibo_disponivel: true,
  guia_fiscal_id: "g1",
  erro_codigo: null,
  created_at: "2026-05-01T00:00:00.000Z",
  updated_at: "2026-05-02T00:00:00.000Z"
};

describe("cliente-fiscal-indicators (EXEQ-FISC-079)", () => {
  it("resolve certificado ausente", () => {
    const ind = resolveCertificadoIndicator(null);
    expect(ind.tone).toBe("missing");
    expect(ind.label).toMatch(/Sem cert/i);
  });

  it("resolve certificado vigente", () => {
    const ind = resolveCertificadoIndicator(cert, { days_left: 120, valid_until: cert.valid_until });
    expect(ind.tone).toBe("ok");
    expect(ind.label).toBe("Vigente");
  });

  it("resolve procuração SERPRO válida", () => {
    const ind = resolveProcuracaoIndicator(procuracaoValida);
    expect(ind.tone).toBe("green");
    expect(ind.label).toBe("Proc. OK");
  });

  it("resolve procuração ausente", () => {
    const ind = resolveProcuracaoIndicator(null);
    expect(ind.label).toBe("Sem proc.");
  });

  it("indexa último processamento por cliente", () => {
    const older: ProcessamentoFiscalRow = {
      ...procConcluido,
      id: "proc-old",
      updated_at: "2026-04-01T00:00:00.000Z"
    };
    const map = indexLatestProcessamentosByCliente([older, procConcluido]);
    expect(map.get("c1")?.id).toBe("proc-1");
  });

  it("formata competência curta", () => {
    expect(formatCompetenciaShort("2026-05")).toBe("Mai/26");
    expect(formatCompetenciaShort(null)).toBe("");
  });

  it("resolve indicador de processamento concluído", () => {
    const ind = resolveProcessamentoIndicator(procConcluido);
    expect(ind.id).toBe("proc-1");
    expect(ind.label).toMatch(/Concluído/i);
    expect(ind.label).toMatch(/Mai\/26/);
  });

  it("monta indicadores completos", () => {
    const bundle = buildClienteFiscalIndicators({
      certificado: cert,
      procuracao: procuracaoValida,
      latestProcessamento: procConcluido
    });
    expect(bundle.certificado.label).toBeTruthy();
    expect(bundle.procuracao.label).toBe("Proc. OK");
    expect(bundle.processamento.id).toBe("proc-1");
  });

  it("novaApuracaoImportHref inclui clienteId", () => {
    expect(novaApuracaoImportHref("c1")).toContain("clienteId=c1");
    expect(novaApuracaoImportHref()).toBe("/processamentos-fiscais/importar");
  });

  it("expiringCertificatesByCliente indexa por portal_cliente_id", () => {
    const map = expiringCertificatesByCliente([
      {
        id: "e1",
        portal_cliente_id: "c1",
        label: "A1",
        valid_until: "2026-06-01",
        status: "ok",
        days_left: 5
      }
    ]);
    expect(map.get("c1")?.days_left).toBe(5);
  });
});
