import type { SerproAuthContext } from "./serpro-auth-context";

export type SerproAmbiente = "demo" | "prod";

export type SerproPedidoDados = {
  idSistema: string;
  idServico: string;
  versaoSistema: string;
  dados: string;
};

export type SerproIntegraRequest = {
  contratante: { numero: string; tipo: number };
  autorPedidoDados: { numero: string; tipo: number };
  contribuinte: { numero: string; tipo: number };
  pedidoDados: SerproPedidoDados;
};

export type SerproIntegraResponse = {
  ok: boolean;
  statusCode: number;
  protocolo?: string;
  rawBody: unknown;
  erroCodigo?: string;
  erroMensagem?: string;
  pdfBytes?: Buffer;
};

export interface SerproIntegraContadorClient {
  consultar(request: SerproIntegraRequest, auth: SerproAuthContext): Promise<SerproIntegraResponse>;
  declarar(request: SerproIntegraRequest, auth: SerproAuthContext): Promise<SerproIntegraResponse>;
  emitir(request: SerproIntegraRequest, auth: SerproAuthContext): Promise<SerproIntegraResponse>;
}

export class SerproIntegraError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly statusCode?: number,
    readonly detail?: unknown
  ) {
    super(message);
    this.name = "SerproIntegraError";
  }
}
