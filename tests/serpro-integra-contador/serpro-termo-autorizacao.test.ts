import { describe, expect, it } from "vitest";
import {
  buildSerproTermoAutorizacaoXml,
  encodeSerproTermoXmlBase64
} from "../../src/modules/serpro-integra-contador/infrastructure/serpro-termo-autorizacao";
import { buildSerproEnvioXmlAssinadoRequest } from "../../src/modules/serpro-integra-contador/infrastructure/serpro-request-builder";

describe("buildSerproTermoAutorizacaoXml", () => {
  it("monta XML compacto com contratante e autor PJ", () => {
    const xml = buildSerproTermoAutorizacaoXml({
      contratanteCnpj: "37229907000137",
      contratanteNome: "EXEQ TECNOLOGIA",
      autorDocumento: "37229907000137",
      autorNome: "RICARDO VITORIANO BARRETO",
      autorTipo: "PJ",
      vigenciaAte: new Date("2026-09-05"),
      assinadoEm: new Date("2026-06-06")
    });
    expect(xml).toContain('numero="37229907000137"');
    expect(xml).toContain('nome="EXEQ TECNOLOGIA"');
    expect(xml).toContain('nome="RICARDO VITORIANO BARRETO"');
    expect(xml).not.toMatch(/>\s+\n\s+</);
    expect(xml).toMatch(/dataAssinatura data="\d{8}"/);
    expect(xml).toMatch(/vigencia data="\d{8}"/);
  });
});
describe("buildSerproEnvioXmlAssinadoRequest", () => {
  it("usa AUTENTICAPROCURADOR/ENVIOXMLASSINADO81", () => {
    const xmlBase64 = encodeSerproTermoXmlBase64("<termo/>");
    const req = buildSerproEnvioXmlAssinadoRequest({
      contratanteCnpj: "37229907000137",
      autorPedidoDocumento: "37229907000137",
      contribuinteCnpj: "37229907000137",
      xmlBase64
    });
    expect(req.pedidoDados.idSistema).toBe("AUTENTICAPROCURADOR");
    expect(req.pedidoDados.idServico).toBe("ENVIOXMLASSINADO81");
    expect(req.autorPedidoDados.numero).toBe("37229907000137");
    expect(JSON.parse(req.pedidoDados.dados)).toEqual({ xml: xmlBase64 });
  });
});

describe("buildSerproPgdasdTransmitRequest autor", () => {
  it("autorPedidoDados segue contribuinte por padrao", async () => {
    const { buildSerproPgdasdTransmitRequest } = await import(
      "../../src/modules/serpro-integra-contador/infrastructure/serpro-request-builder"
    );
    const { sampleCanonicalApuracao } = await import("../fixtures/pgdasd-sample-apuracao");
    const req = buildSerproPgdasdTransmitRequest({
      contratanteCnpj: "37229907000137",
      contribuinteCnpj: "37229907000137",
      apuracao: sampleCanonicalApuracao({ cnpj: "37229907000137", receitaBrutaMes: 1000, valorTotalDas: 100 })
    });
    expect(req.autorPedidoDados.numero).toBe("37229907000137");
    expect(req.contratante.numero).toBe("37229907000137");
  });
});
