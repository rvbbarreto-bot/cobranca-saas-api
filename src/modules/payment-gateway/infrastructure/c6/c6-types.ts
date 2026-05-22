export type C6TokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
};

/** Resposta inferida — ajustar quando doc oficial C6 divergir. */
export type C6BoletoResponse = {
  id?: string;
  numeroTitulo?: string;
  codigoBarras?: string;
  linhaDigitavel?: string;
  nossoNumero?: string;
  situacao?: string;
  urlBoleto?: string;
};

export type C6EmitBoletoPayload = {
  conta: string;
  agencia: string;
  codigoCedente: string;
  modalidade: string;
  numeroTitulo: string;
  dataVencimento: string;
  valor: number;
  pagador: {
    nome: string;
    cpfCnpj: string;
    tipoPessoa: "FISICA" | "JURIDICA";
    endereco: string;
    bairro: string;
    cidade: string;
    uf: string;
    cep: string;
  };
};
