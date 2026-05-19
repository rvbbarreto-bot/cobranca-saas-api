/** Tipos minimos das respostas Asaas API v3 (somente campos usados pelo adapter). */

export type AsaasCustomerResponse = {
  id: string;
};

export type AsaasPaymentResponse = {
  id: string;
  status?: string;
  dueDate?: string;
  bankSlipUrl?: string | null;
  invoiceUrl?: string | null;
  barCode?: string | null;
  identificationField?: string | null;
  nossoNumero?: string | null;
  paymentDate?: string | null;
  confirmedDate?: string | null;
  clientPaymentDate?: string | null;
};

export type AsaasPixQrCodeResponse = {
  encodedImage?: string | null;
  payload?: string | null;
  expirationDate?: string | null;
};
