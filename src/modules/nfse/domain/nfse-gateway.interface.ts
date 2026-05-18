export interface EmitirNfseInput {
  referencia: string;
  prestador: {
    cnpj: string;
    inscricaoMunicipal: string;
    codigoMunicipio: string;
    regimeTributario: 1 | 3 | 5;
  };
  tomador: {
    cpfCnpj: string;
    razaoSocial: string;
    email: string;
    telefone?: string;
    endereco?: {
      logradouro: string;
      numero: string;
      bairro: string;
      codigoMunicipio: string;
      uf: string;
      cep: string;
    };
  };
  servico: {
    valor: number;
    issRetido: boolean;
    itemListaServico: string;
    discriminacao: string;
    codigoMunicipio: string;
    codigoCnae?: string;
    aliquota?: number;
    valorDeducoes?: number;
  };
  dataEmissao: string;
}

export interface NfseResult {
  numeroNfse: string;
  codigoVerificacao: string;
  pdfUrl: string;
  xmlUrl: string;
  emitidoEm: Date;
}

export type NfseConsultaStatus = "autorizado" | "erro" | "cancelado" | "emitindo";

export interface NfseGatewayAdapter {
  emitir(input: EmitirNfseInput): Promise<NfseResult>;
  consultar(referencia: string): Promise<{
    status: NfseConsultaStatus;
    numeroNfse?: string;
    codigoVerificacao?: string;
    pdfUrl?: string;
    xmlUrl?: string;
    erroMessage?: string;
  }>;
  cancelar(referencia: string, justificativa?: string): Promise<void>;
}
