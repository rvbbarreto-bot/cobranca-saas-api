export type ReceitaDasCaptureInput = {
  cnpj: string;
  competencia: string;
  certPem: string;
  keyPem: string;
  procuradorDocumento?: string;
};

export type ReceitaDarfCaptureInput = {
  cnpj: string;
  competencia: string;
  codigoReceita: string;
  periodoApuracao: string;
  certPem: string;
  keyPem: string;
  procuradorDocumento?: string;
};

export type ReceitaComplianceStatus = "pendente" | "aprovado" | "bloqueado" | "dispensado";

/** @deprecated use ReceitaComplianceStatus */
export type ReceitaDasComplianceStatus = ReceitaComplianceStatus;

export type ReceitaCaptureResult = {
  valorPrincipal: number;
  valorMulta: number;
  valorJuros: number;
  dataVencimento: string;
  linhaDigitavel: string;
  pixCopiaCola?: string;
  pdfBytes?: Buffer;
  complianceStatus?: ReceitaComplianceStatus;
  complianceMotivo?: string;
};

/** @deprecated use ReceitaCaptureResult */
export type ReceitaDasCaptureResult = ReceitaCaptureResult;

export interface ReceitaDasGateway {
  captureDas(input: ReceitaDasCaptureInput): Promise<ReceitaCaptureResult>;
}

export interface ReceitaDarfGateway {
  captureDarf(input: ReceitaDarfCaptureInput): Promise<ReceitaCaptureResult>;
}

export type ReceitaFiscalGateway = ReceitaDasGateway & ReceitaDarfGateway;
