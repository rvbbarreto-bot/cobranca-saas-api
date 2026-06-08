import type { SerproIntegraRequest, SerproPedidoDados } from "../domain/serpro-types";

export function serproBaseUrl(ambiente: "demo" | "prod"): string {
  if (ambiente === "prod") {
    return (process.env.SERPRO_PROD_BASE_URL || "https://gateway.apiserpro.serpro.gov.br").replace(
      /\/$/,
      ""
    );
  }
  return (process.env.SERPRO_DEMO_BASE_URL || "https://gateway.apiserpro.serpro.gov.br").replace(
    /\/$/,
    ""
  );
}

function buildSerproRequest(input: {
  contratanteCnpj: string;
  contribuinteCnpj: string;
  idSistema: string;
  idServico: string;
  dados: Record<string, unknown>;
}): SerproIntegraRequest {
  const cnpjContratante = input.contratanteCnpj.replace(/\D/g, "");
  const cnpjContribuinte = input.contribuinteCnpj.replace(/\D/g, "");
  const pedidoDados: SerproPedidoDados = {
    idSistema: input.idSistema,
    idServico: input.idServico,
    versaoSistema: "1.0",
    dados: JSON.stringify(input.dados)
  };
  return {
    contratante: { numero: cnpjContratante, tipo: 2 },
    autorPedidoDados: { numero: cnpjContratante, tipo: 2 },
    contribuinte: { numero: cnpjContribuinte, tipo: 2 },
    pedidoDados
  };
}

export function buildSerproPgdasdTransmitRequest(input: {
  contratanteCnpj: string;
  contribuinteCnpj: string;
  competencia: string;
  declaracaoPayload: Record<string, unknown>;
}): SerproIntegraRequest {
  const pa = input.competencia.replace("-", "");
  return buildSerproRequest({
    contratanteCnpj: input.contratanteCnpj,
    contribuinteCnpj: input.contribuinteCnpj,
    idSistema: "PGDASD",
    idServico: "TRANSDECLARACAO11",
    dados: { pa, ...input.declaracaoPayload }
  });
}

export function buildSerproObterProcuracaoRequest(input: {
  contratanteCnpj: string;
  contribuinteCnpj: string;
  procuradorDocumento: string;
}): SerproIntegraRequest {
  return buildSerproRequest({
    contratanteCnpj: input.contratanteCnpj,
    contribuinteCnpj: input.contribuinteCnpj,
    idSistema: "PROCURACOES",
    idServico: "OBTERPROCURACAO41",
    dados: {
      procurador: input.procuradorDocumento.replace(/\D/g, "")
    }
  });
}

export function buildSerproConsultReciboRequest(input: {
  contratanteCnpj: string;
  contribuinteCnpj: string;
  competencia: string;
  protocolo?: string;
}): SerproIntegraRequest {
  const pa = input.competencia.replace("-", "");
  return buildSerproRequest({
    contratanteCnpj: input.contratanteCnpj,
    contribuinteCnpj: input.contribuinteCnpj,
    idSistema: "PGDASD",
    idServico: "CONSDECREC15",
    dados: { pa, protocolo: input.protocolo }
  });
}

export function buildSerproEmitDasRequest(input: {
  contratanteCnpj: string;
  contribuinteCnpj: string;
  competencia: string;
  valorDas: number;
}): SerproIntegraRequest {
  const pa = input.competencia.replace("-", "");
  return buildSerproRequest({
    contratanteCnpj: input.contratanteCnpj,
    contribuinteCnpj: input.contribuinteCnpj,
    idSistema: "PGDASD",
    idServico: "GERARDAS12",
    dados: { pa, valorDas: input.valorDas }
  });
}
