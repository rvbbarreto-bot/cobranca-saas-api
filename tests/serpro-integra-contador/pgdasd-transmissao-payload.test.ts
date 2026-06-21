import { describe, expect, it } from "vitest";
import {
  buildPgdasdTransmissaoDadosFromApuracao,
  parsePgdasdPedidoDados,
  PGDASD_ANEXO_ID_ATIVIDADE,
  PGDASD_CODIGO_TRIBUTO
} from "../../src/modules/serpro-integra-contador/domain/pgdasd-transmissao-payload";
import { buildSerproPgdasdTransmitRequest } from "../../src/modules/serpro-integra-contador/infrastructure/serpro-request-builder";
import { sampleCanonicalApuracao } from "../fixtures/pgdasd-sample-apuracao";

describe("buildPgdasdTransmissaoDadosFromApuracao", () => {
  it("monta cnpjCompleto, pa numerico e declaracao conforme doc SERPRO", () => {
    const apuracao = sampleCanonicalApuracao({ cnpj: "37229907000137", competencia: "2024-01" });
    const dados = buildPgdasdTransmissaoDadosFromApuracao(apuracao);

    expect(dados.cnpjCompleto).toBe("37229907000137");
    expect(dados.pa).toBe(202401);
    expect(typeof dados.pa).toBe("number");
    expect(dados.indicadorTransmissao).toBe(true);
    expect(dados.indicadorComparacao).toBe(false);
    expect(dados.declaracao.tipoDeclaracao).toBe(1);
    expect(dados.declaracao.receitaPaCompetenciaInterno).toBe(85000);
    expect(dados.declaracao.estabelecimentos).toHaveLength(1);
    expect(dados.declaracao.estabelecimentos[0]?.cnpjCompleto).toBe("37229907000137");
    expect(dados.declaracao.estabelecimentos[0]?.atividades?.[0]?.idAtividade).toBe(
      PGDASD_ANEXO_ID_ATIVIDADE.ANEXO_III
    );
    expect(dados.valoresParaComparacao).toBeUndefined();
  });

  it("inclui valoresParaComparacao quando indicadorComparacao=true", () => {
    const apuracao = sampleCanonicalApuracao({
      tributos: { inss: 100, icms: 50, iss: 25, pisCofins: 10 }
    });
    const dados = buildPgdasdTransmissaoDadosFromApuracao(apuracao, { indicadorComparacao: true });

    expect(dados.indicadorComparacao).toBe(true);
    expect(dados.valoresParaComparacao).toEqual(
      expect.arrayContaining([
        { codigoTributo: PGDASD_CODIGO_TRIBUTO.cpp, valor: 100 },
        { codigoTributo: PGDASD_CODIGO_TRIBUTO.icms, valor: 50 },
        { codigoTributo: PGDASD_CODIGO_TRIBUTO.iss, valor: 25 },
        { codigoTributo: PGDASD_CODIGO_TRIBUTO.pis, valor: 5 },
        { codigoTributo: PGDASD_CODIGO_TRIBUTO.cofins, valor: 5 }
      ])
    );
  });

  it("rejeita competencia invalida", () => {
    const apuracao = sampleCanonicalApuracao({ competencia: "2024-13" as "2024-01" });
    expect(() => buildPgdasdTransmissaoDadosFromApuracao(apuracao)).toThrow(/PGDASD_PA_INVALIDO/);
  });
});

describe("buildSerproPgdasdTransmitRequest", () => {
  it("serializa dados como escaped JSON string com campos SERPRO", () => {
    const apuracao = sampleCanonicalApuracao();
    const req = buildSerproPgdasdTransmitRequest({
      contratanteCnpj: "37229907000137",
      contribuinteCnpj: apuracao.cnpj,
      apuracao
    });

    expect(req.pedidoDados.idSistema).toBe("PGDASD");
    expect(req.pedidoDados.idServico).toBe("TRANSDECLARACAO11");
    const dados = parsePgdasdPedidoDados(req.pedidoDados.dados);
    expect(dados.cnpjCompleto).toBe("00000000000191");
    expect(dados.pa).toBe(202605);
    expect(dados.declaracao.estabelecimentos[0]?.atividades?.[0]?.valorAtividade).toBe(85000);
  });

  it("autorPedidoDados segue contribuinte por padrao", () => {
    const req = buildSerproPgdasdTransmitRequest({
      contratanteCnpj: "37229907000137",
      contribuinteCnpj: "37229907000137",
      apuracao: sampleCanonicalApuracao({ cnpj: "37229907000137" })
    });
    expect(req.autorPedidoDados.numero).toBe("37229907000137");
    expect(req.contratante.numero).toBe("37229907000137");
  });
});
