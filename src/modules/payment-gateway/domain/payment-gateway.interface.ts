/**
 * Contrato do adapter de gateway (Asaas, Pagarme, …).
 * Nao alterar assinaturas sem revisao de arquitetura — ver PROMPT_FABRICA_KICKOFF Sprint 1.
 */

export interface CustomerAddressInput {
  logradouro: string;
  numero?: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
}

export interface CreateCustomerInput {
  name: string;
  cpfCnpj: string;
  email: string;
  phone?: string;
  /** portal_cliente_id ou outro id estavel no nosso dominio */
  externalReference: string;
  /** Obrigatorio para alguns bancos (Inter, Cora, BB). */
  endereco?: CustomerAddressInput;
}

export interface CreateBoletoInput {
  gatewayCustomerId: string;
  value: number;
  /** YYYY-MM-DD */
  dueDate: string;
  description: string;
  /** idempotency_key da cobranca */
  externalReference: string;
  /** Percentual de multa (padrao Asaas: 2) */
  finePercent?: number;
  /** Percentual de juros ao mes (padrao Asaas: 0.033) */
  interestPercent?: number;
}

export interface BoletoResult {
  gatewayTransactionId: string;
  boletoUrl: string;
  boletoPdfUrl: string;
  barCode: string;
  identificationField: string;
  nossoNumero: string;
  expiresAt: Date;
  /** Resposta bruta do provedor (auditoria). */
  providerRaw?: Record<string, unknown>;
}

export interface CreatePixInput {
  gatewayCustomerId: string;
  value: number;
  /** YYYY-MM-DD */
  dueDate: string;
  description: string;
  externalReference: string;
}

export interface PixResult {
  gatewayTransactionId: string;
  pixQrcodeBase64: string;
  /** Payload EMV (copia e cola) */
  pixEmv: string;
  pixLink: string;
  expiresAt: Date;
  providerRaw?: Record<string, unknown>;
}

export interface GatewayChargeSnapshot {
  status: string;
  paidAt?: Date;
}

export interface PaymentGatewayAdapter {
  createCustomer(input: CreateCustomerInput): Promise<string>;
  createBoleto(input: CreateBoletoInput): Promise<BoletoResult>;
  createPix(input: CreatePixInput): Promise<PixResult>;
  cancelCharge(gatewayTransactionId: string): Promise<void>;
  getCharge(gatewayTransactionId: string): Promise<GatewayChargeSnapshot>;
}
