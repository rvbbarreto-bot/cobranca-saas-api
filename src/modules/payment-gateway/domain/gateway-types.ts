import type { CreateCustomerInput } from "./payment-gateway.interface";

/** Credenciais descriptografadas — shape do JSON em escritorio_config (migration 025). */
export type GatewayCredentials = Record<string, string>;

/** Contexto passado ao construir qualquer adapter. */
export type GatewayAdapterContext = {
  tenantId: string;
  provider: string;
  credentials: GatewayCredentials;
  sandbox: boolean;
};

/** Entrada de emissão agregada (uso interno factory/worker — NÃO substitui CreateBoletoInput). */
export type ChargeEmissionContext = {
  chargeId: string;
  tenantId: string;
  reference: string;
  idempotencyKey: string;
  amount: number;
  dueDate: string;
  type: "boleto" | "pix";
  cliente: {
    id: string;
    documento: string;
    nome: string;
    email: string | null;
    telefone: string | null;
    gatewayCustomerId: string | null;
    endereco?: CreateCustomerInput["endereco"];
  };
};

/** Resultado normalizado pós-emissão (mapeia para BoletoResult | PixResult). */
export type GatewayEmissionResult = {
  gatewayTransactionId: string;
  boleto?: import("./payment-gateway.interface").BoletoResult;
  pix?: import("./payment-gateway.interface").PixResult;
  providerRaw?: Record<string, unknown>;
};
