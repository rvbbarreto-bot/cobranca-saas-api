export type InterTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
};

export type InterBoletoResponse = {
  codigoSolicitacao?: string;
  situacao?: string;
  nossoNumero?: string;
  codigoBarras?: string;
  linhaDigitavel?: string;
  dataVencimento?: string;
};

export type InterPagadorPayload = {
  cpfCnpj: string;
  tipoPessoa: "FISICA" | "JURIDICA";
  nome: string;
  endereco: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  email?: string;
  ddd?: string;
  telefone?: string;
};

export type InterEmitBoletoPayload = {
  seuNumero: string;
  valorNominal: number;
  dataVencimento: string;
  numDiasAgenda: number;
  pagador: InterPagadorPayload;
  mensagem?: { linha1?: string; linha2?: string };
};
