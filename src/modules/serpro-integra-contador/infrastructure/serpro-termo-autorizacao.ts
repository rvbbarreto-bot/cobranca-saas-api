import { SignedXml } from "xml-crypto";
import { DOMParser } from "@xmldom/xmldom";

const TERMO_TEXTO =
  "Autorizo a empresa CONTRATANTE, identificada neste termo de autorização como DESTINATÁRIO, a executar as requisições dos serviços web disponibilizados pela API INTEGRA CONTADOR, onde terei o papel de AUTOR PEDIDO DE DADOS no corpo da mensagem enviada na requisição do serviço web. Esse termo de autorização está assinado digitalmente com o certificado digital do PROCURADOR ou OUTORGADO DO CONTRIBUINTE responsável, identificado como AUTOR DO PEDIDO DE DADOS.";

const AVISO_LEGAL_TEXTO =
  "O acesso a estas informações foi autorizado pelo próprio PROCURADOR ou OUTORGADO DO CONTRIBUINTE, responsável pela informação, via assinatura digital. É dever do destinatário da autorização e consumidor deste acesso observar a adoção de base legal para o tratamento dos dados recebidos conforme artigos 7º ou 11º da LGPD (Lei n.º 13.709, de 14 de agosto de 2018), aos direitos do titular dos dados (art. 9º, 17 e 18, da LGPD) e aos princípios que norteiam todos os tratamentos de dados no Brasil (art. 6º, da LGPD).";

const FINALIDADE_TEXTO =
  "A finalidade única e exclusiva desse TERMO DE AUTORIZAÇÃO, é garantir que o CONTRATANTE apresente a API INTEGRA CONTADOR esse consentimento do PROCURADOR ou OUTORGADO DO CONTRIBUINTE assinado digitalmente, para que possa realizar as requisições dos serviços web da API INTEGRA CONTADOR em nome do AUTOR PEDIDO DE DADOS (PROCURADOR ou OUTORGADO DO CONTRIBUINTE).";

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

export type BuildSerproTermoInput = {
  contratanteCnpj: string;
  contratanteNome: string;
  autorDocumento: string;
  autorNome: string;
  /** PF = CPF (11), PJ = CNPJ (14) */
  autorTipo: "PF" | "PJ";
  vigenciaAte: Date;
  assinadoEm?: Date;
};

/** XML compacto (sem indentação) — exigência SERPRO para validação da assinatura. */
export function buildSerproTermoAutorizacaoXml(input: BuildSerproTermoInput): string {
  const assinadoEm = input.assinadoEm ?? new Date();
  const autorTipoAttr = input.autorTipo === "PF" ? "PF" : "PJ";
  const contratante = input.contratanteCnpj.replace(/\D/g, "");
  const autor = input.autorDocumento.replace(/\D/g, "");

  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<termoDeAutorizacao>` +
    `<dados>` +
    `<sistema id="API Integra Contador"/>` +
    `<termo texto="${xmlEscape(TERMO_TEXTO)}"/>` +
    `<avisoLegal texto="${xmlEscape(AVISO_LEGAL_TEXTO)}"/>` +
    `<finalidade texto="${xmlEscape(FINALIDADE_TEXTO)}"/>` +
    `<dataAssinatura data="${formatYmd(assinadoEm)}"/>` +
    `<vigencia data="${formatYmd(input.vigenciaAte)}"/>` +
    `<destinatario numero="${contratante}" nome="${xmlEscape(input.contratanteNome)}" tipo="PJ" papel="contratante"/>` +
    `<assinadoPor numero="${autor}" nome="${xmlEscape(input.autorNome)}" tipo="${autorTipoAttr}" papel="autor pedido de dados"/>` +
    `</dados>` +
    `</termoDeAutorizacao>`
  );
}

export function signSerproTermoAutorizacaoXml(
  xml: string,
  certificadoPem: string,
  chavePrivadaPem: string
): string {
  const sig = new SignedXml({
    privateKey: chavePrivadaPem,
    publicCert: certificadoPem
  });
  sig.signatureAlgorithm = "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256";
  sig.canonicalizationAlgorithm = "http://www.w3.org/TR/2001/REC-xml-c14n-20010315";
  sig.addReference({
    xpath: "//*[local-name(.)='termoDeAutorizacao']",
    uri: "",
    isEmptyUri: true,
    transforms: [
      "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
      "http://www.w3.org/TR/2001/REC-xml-c14n-20010315"
    ],
    digestAlgorithm: "http://www.w3.org/2001/04/xmlenc#sha256"
  });
  sig.computeSignature(xml, {
    location: { reference: "//*[local-name(.)='termoDeAutorizacao']", action: "append" }
  });
  const signed = sig.getSignedXml();
  const doc = new DOMParser().parseFromString(signed, "text/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) {
    throw new Error("XML assinado invalido apos xml-crypto.");
  }
  if (!signed.includes('Reference URI=""')) {
    throw new Error("Assinatura SERPRO deve usar Reference URI=\"\" (enveloped).");
  }
  return signed;
}

export function encodeSerproTermoXmlBase64(signedXml: string): string {
  return Buffer.from(signedXml, "utf8").toString("base64");
}
