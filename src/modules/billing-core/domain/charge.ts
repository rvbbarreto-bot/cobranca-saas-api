export type CanonicalChargeStatus =
  | "rascunho"
  | "emitida"
  | "enviada"
  | "pendente_pagamento"
  | "paga"
  | "vencida"
  | "cancelada"
  | "erro_emissao";

export type ChargePaymentType = "boleto" | "pix";

export type Charge = {
  id: string;
  tenantId: string;
  reference: string;
  idempotencyKey: string;
  amount: string;
  dueDate: string;
  type: ChargePaymentType;
  canonicalStatus: CanonicalChargeStatus;
  provider: string | null;
  providerChargeId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

/** Dados da última transação de gateway (portal / detalhe da cobrança). */
export type ChargePaymentView = {
  type: ChargePaymentType;
  boleto_url: string | null;
  boleto_pdf_url: string | null;
  boleto_barcode: string | null;
  pix_qrcode_base64: string | null;
  pix_emv: string | null;
  pix_link: string | null;
  expires_at: string | null;
};
