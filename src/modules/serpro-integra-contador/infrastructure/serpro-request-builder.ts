import type { CanonicalApuracao } from "../../fiscal-ingestion/domain/canonical-apuracao.schema";
import {
  buildPgdasdTransmissaoDadosFromApuracao,
  type PgdasdTransmissaoOptions
} from "../domain/pgdasd-transmissao-payload";
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

/** OAuth Loja SERPRO — path correto é `/token` (não `/oauth/token`). */
export function serproTokenUrl(ambiente: "demo" | "prod"): string {
  const base = serproBaseUrl(ambiente);
  const path = process.env.SERPRO_TOKEN_PATH?.trim() || "/token";
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

function documentoTipo(numero: string): number {
  const digits = numero.replace(/\D/g, "");
  return digits.length === 11 ? 1 : 2;
}

function buildSerproRequest(input: {
  contratanteCnpj: string;
  contribuinteCnpj: string;
  autorPedidoDocumento?: string;
  idSistema: string;
  idServico: string;
  dados: Record<string, unknown> | object;
}): SerproIntegraRequest {
  const cnpjContratante = input.contratanteCnpj.replace(/\D/g, "");
  const cnpjContribuinte = input.contribuinteCnpj.replace(/\D/g, "");
  const autorNumero = (input.autorPedidoDocumento ?? input.contribuinteCnpj).replace(/\D/g, "");
  const pedidoDados: SerproPedidoDados = {
    idSistema: input.idSistema,
    idServico: input.idServico,
    versaoSistema: "1.0",
    dados: JSON.stringify(input.dados)
  };
  return {
    contratante: { numero: cnpjContratante, tipo: 2 },
    autorPedidoDados: { numero: autorNumero, tipo: documentoTipo(autorNumero) },
    contribuinte: { numero: cnpjContribuinte, tipo: 2 },
    pedidoDados
  };
}

export function buildSerproEnvioXmlAssinadoRequest(input: {
  contratanteCnpj: string;
  autorPedidoDocumento: string;
  contribuinteCnpj: string;
  xmlBase64: string;
}): SerproIntegraRequest {
  return buildSerproRequest({
    contratanteCnpj: input.contratanteCnpj,
    contribuinteCnpj: input.contribuinteCnpj,
    autorPedidoDocumento: input.autorPedidoDocumento,
    idSistema: "AUTENTICAPROCURADOR",
    idServico: "ENVIOXMLASSINADO81",
    dados: { xml: input.xmlBase64 }
  });
}

export function buildSerproPgdasdTransmitRequest(input: {
  contratanteCnpj: string;
  contribuinteCnpj: string;
  autorPedidoDocumento?: string;
  apuracao: CanonicalApuracao;
  pgdasdOptions?: PgdasdTransmissaoOptions;
}): SerproIntegraRequest {
  const dados = buildPgdasdTransmissaoDadosFromApuracao(input.apuracao, input.pgdasdOptions);
  return buildSerproRequest({
    contratanteCnpj: input.contratanteCnpj,
    contribuinteCnpj: input.contribuinteCnpj,
    autorPedidoDocumento: input.autorPedidoDocumento,
    idSistema: "PGDASD",
    idServico: "TRANSDECLARACAO11",
    dados
  });
}

export function buildSerproObterProcuracaoRequest(input: {
  contratanteCnpj: string;
  contribuinteCnpj: string;
  procuradorDocumento: string;
  autorPedidoDocumento?: string;
}): SerproIntegraRequest {
  return buildSerproRequest({
    contratanteCnpj: input.contratanteCnpj,
    contribuinteCnpj: input.contribuinteCnpj,
    autorPedidoDocumento: input.autorPedidoDocumento ?? input.procuradorDocumento,
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
  autorPedidoDocumento?: string;
  competencia: string;
  protocolo?: string;
}): SerproIntegraRequest {
  const pa = input.competencia.replace("-", "");
  return buildSerproRequest({
    contratanteCnpj: input.contratanteCnpj,
    contribuinteCnpj: input.contribuinteCnpj,
    autorPedidoDocumento: input.autorPedidoDocumento,
    idSistema: "PGDASD",
    idServico: "CONSDECREC15",
    dados: { pa, protocolo: input.protocolo }
  });
}

export function buildSerproEmitDasRequest(input: {
  contratanteCnpj: string;
  contribuinteCnpj: string;
  autorPedidoDocumento?: string;
  competencia: string;
  valorDas: number;
}): SerproIntegraRequest {
  const pa = input.competencia.replace("-", "");
  return buildSerproRequest({
    contratanteCnpj: input.contratanteCnpj,
    contribuinteCnpj: input.contribuinteCnpj,
    autorPedidoDocumento: input.autorPedidoDocumento,
    idSistema: "PGDASD",
    idServico: "GERARDAS12",
    dados: { pa, valorDas: input.valorDas }
  });
}

export function buildSerproEmitDarfRequest(input: {
  contratanteCnpj: string;
  contribuinteCnpj: string;
  autorPedidoDocumento?: string;
  competencia: string;
  codigoReceita: string;
  periodoApuracao: string;
}): SerproIntegraRequest {
  const pa = input.competencia.replace("-", "");
  return buildSerproRequest({
    contratanteCnpj: input.contratanteCnpj,
    contribuinteCnpj: input.contribuinteCnpj,
    autorPedidoDocumento: input.autorPedidoDocumento,
    idSistema: "DCTFWEB",
    idServico: "CONSOLIDARGERARDARF51",
    dados: {
      pa,
      codigoReceita: input.codigoReceita.replace(/\D/g, ""),
      periodoApuracao: input.periodoApuracao
    }
  });
}
