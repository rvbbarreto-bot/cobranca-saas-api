export type ProcessamentoStatus =
  | "RASCUNHO"
  | "VALIDANDO"
  | "VALIDADO"
  | "TRANSMITINDO"
  | "TRANSMITIDA"
  | "RECIBO_OK"
  | "EMITINDO_DAS"
  | "CONCLUIDO"
  | "ERRO";

export const TERMINAL_PROCESSAMENTO_STATUS: ProcessamentoStatus[] = ["CONCLUIDO", "ERRO"];

export function canTransitionProcessamento(from: ProcessamentoStatus, to: ProcessamentoStatus): boolean {
  const map: Record<ProcessamentoStatus, ProcessamentoStatus[]> = {
    RASCUNHO: ["VALIDANDO", "ERRO"],
    VALIDANDO: ["VALIDADO", "ERRO"],
    VALIDADO: ["TRANSMITINDO", "ERRO"],
    TRANSMITINDO: ["TRANSMITIDA", "ERRO"],
    TRANSMITIDA: ["RECIBO_OK", "ERRO"],
    RECIBO_OK: ["EMITINDO_DAS", "ERRO"],
    EMITINDO_DAS: ["CONCLUIDO", "ERRO"],
    CONCLUIDO: [],
    ERRO: []
  };
  return map[from]?.includes(to) ?? false;
}
