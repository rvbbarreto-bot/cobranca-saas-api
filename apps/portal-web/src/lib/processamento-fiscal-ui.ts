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

export type StepVisualState = "pending" | "active" | "done" | "error";

export const PROCESSAMENTO_POLL_MS = 3000;

/** Pipeline visível na tela de detalhe (EXEQ-FISC-073). */
export const TRANSMISSION_PIPELINE_STEPS = [
  { key: "validado", label: "Apuração validada" },
  { key: "transmitindo", label: "Enviando à Receita" },
  { key: "recibo", label: "Obtendo recibo" },
  { key: "emitindo_das", label: "Gerando DAS" },
  { key: "concluido", label: "Concluído" }
] as const;

const STATUS_RANK: Record<ProcessamentoStatus, number> = {
  RASCUNHO: -1,
  VALIDANDO: -1,
  VALIDADO: 0,
  TRANSMITINDO: 1,
  TRANSMITIDA: 2,
  RECIBO_OK: 3,
  EMITINDO_DAS: 4,
  CONCLUIDO: 5,
  ERRO: -2
};

const STATUS_LABEL: Record<ProcessamentoStatus, string> = {
  RASCUNHO: "Rascunho",
  VALIDANDO: "Validando",
  VALIDADO: "Validado",
  TRANSMITINDO: "Transmitindo",
  TRANSMITIDA: "Transmitida",
  RECIBO_OK: "Recibo disponível",
  EMITINDO_DAS: "Emitindo DAS",
  CONCLUIDO: "Concluído",
  ERRO: "Erro"
};

const STATUS_PILL: Record<ProcessamentoStatus, string> = {
  RASCUNHO: "status-pill--pendente",
  VALIDANDO: "status-pill--pendente",
  VALIDADO: "status-pill--pendente",
  TRANSMITINDO: "status-pill--pendente",
  TRANSMITIDA: "status-pill--pendente",
  RECIBO_OK: "status-pill--pendente",
  EMITINDO_DAS: "status-pill--pendente",
  CONCLUIDO: "status-pill--ativo",
  ERRO: "status-pill--erro"
};

/** @deprecated use TRANSMISSION_PIPELINE_STEPS */
export const PROCESSAMENTO_PIPELINE_STEPS = TRANSMISSION_PIPELINE_STEPS;

const POLLING_STATUSES: ProcessamentoStatus[] = [
  "VALIDADO",
  "TRANSMITINDO",
  "TRANSMITIDA",
  "RECIBO_OK",
  "EMITINDO_DAS"
];

export function processamentoStatusLabel(status: string): string {
  return STATUS_LABEL[status as ProcessamentoStatus] ?? status;
}

export function processamentoStatusPillClass(status: string): string {
  return STATUS_PILL[status as ProcessamentoStatus] ?? "status-pill--pendente";
}

export function shouldPollProcessamentoDetail(status: string | undefined): boolean {
  return POLLING_STATUSES.includes(status as ProcessamentoStatus);
}

export function processamentoLiveUserMessage(status: string): string {
  const map: Record<string, string> = {
    VALIDADO: "Apuração validada. A transmissão será iniciada em instantes.",
    TRANSMITINDO: "Enviando a declaração PGDASD para a Receita Federal. Aguarde…",
    TRANSMITIDA: "Declaração aceita. Estamos buscando o recibo da apuração.",
    RECIBO_OK: "Recibo recebido. Gerando a guia DAS para pagamento.",
    EMITINDO_DAS: "Emitindo o DAS. Quase pronto…",
    CONCLUIDO: "Processo concluído. Você já pode baixar o recibo e o DAS.",
    ERRO: "Não foi possível concluir o processo. Confira a orientação abaixo."
  };
  return map[status] ?? "Acompanhe o andamento pelas etapas.";
}

export type ProcessamentoErroHelp = {
  titulo: string;
  sugestao: string;
};

export function processamentoErroHelp(codigo: string | null | undefined): ProcessamentoErroHelp {
  const map: Record<string, ProcessamentoErroHelp> = {
    PROCURACAO_AUSENTE: {
      titulo: "Procuração não cadastrada",
      sugestao: "Cadastre a procuração e valide na SERPRO em Configuração fiscal."
    },
    PROCURACAO_INVALIDA: {
      titulo: "Procuração inválida na Receita",
      sugestao: "Renove a procuração no e-CAC e clique em Validar procuração na SERPRO."
    },
    SERPRO_ERRO: {
      titulo: "Receita Federal rejeitou a operação",
      sugestao: "Tente novamente em alguns minutos ou contate o suporte Exeq."
    },
    RECIBO_SERPRO_ERRO: {
      titulo: "Recibo não disponível",
      sugestao: "A transmissão pode ter sido aceita; aguarde ou solicite reprocessamento ao suporte."
    },
    DAS_SERPRO_ERRO: {
      titulo: "Falha ao emitir DAS",
      sugestao: "Verifique se a apuração do período está regular na Receita Federal."
    },
    TRANSMISSAO_FALHOU: {
      titulo: "Falha na transmissão",
      sugestao: "Confira certificado, procuração e configuração SERPRO do escritório."
    },
    RECIBO_FALHOU: {
      titulo: "Falha ao obter recibo",
      sugestao: "Aguarde alguns minutos e abra o detalhe do processamento para acompanhar."
    },
    DAS_FALHOU: {
      titulo: "Falha ao emitir DAS",
      sugestao: "Verifique a apuração na Receita ou contate o suporte Exeq."
    }
  };
  return (
    map[codigo ?? ""] ?? {
      titulo: codigo ? `Erro: ${codigo}` : "Erro no processamento",
      sugestao: "Se persistir, envie o ID do processamento ao suporte Exeq."
    }
  );
}

export function inferErroStepIndex(input: {
  status: string;
  protocolo_serpro?: string | null;
  recibo_disponivel?: boolean;
  guia_fiscal_id?: string | null;
}): number {
  if (input.status !== "ERRO") return -1;
  if (!input.protocolo_serpro) return 1;
  if (!input.recibo_disponivel) return 2;
  if (!input.guia_fiscal_id) return 3;
  return 1;
}

export function getTransmissionStepStates(input: {
  status: string;
  protocolo_serpro?: string | null;
  recibo_disponivel?: boolean;
  guia_fiscal_id?: string | null;
}): StepVisualState[] {
  const rank = STATUS_RANK[input.status as ProcessamentoStatus] ?? -1;
  const erroIdx = inferErroStepIndex(input);

  if (input.status === "ERRO" && erroIdx >= 0) {
    return TRANSMISSION_PIPELINE_STEPS.map((_, i) => {
      if (i < erroIdx) return "done";
      if (i === erroIdx) return "error";
      return "pending";
    });
  }

  return TRANSMISSION_PIPELINE_STEPS.map((_, i) => {
    const stepDoneRank = i === 0 ? 1 : i === 1 ? 2 : i === 2 ? 3 : i === 3 ? 5 : 5;
    const stepActiveRank = i === 0 ? 0 : i === 1 ? 1 : i === 2 ? 2 : i === 3 ? 4 : 5;

    if (rank >= stepDoneRank) return "done";
    if (rank === stepActiveRank) return "active";
    if (rank > stepActiveRank && rank < stepDoneRank) return "active";
    return "pending";
  });
}

/** @deprecated use getTransmissionStepStates */
export function processamentoStepIndex(status: string): number {
  const states = getTransmissionStepStates({ status });
  const active = states.lastIndexOf("active");
  if (active >= 0) return active;
  return states.lastIndexOf("done");
}

const EVENTO_LABEL: Record<string, string> = {
  processamento_criado: "Processamento criado a partir do CSV",
  transmissao_iniciada: "Início do envio à Receita",
  transmissao_concluida: "Declaração transmitida com sucesso",
  transmissao_erro: "Falha na transmissão",
  transmissao_bloqueada: "Transmissão bloqueada (pré-requisito)",
  recibo_iniciado: "Consulta do recibo iniciada",
  recibo_concluido: "Recibo da apuração disponível",
  recibo_erro: "Falha ao obter recibo",
  das_iniciado: "Emissão do DAS iniciada",
  das_concluido: "DAS emitido e guia criada",
  das_erro: "Falha na emissão do DAS"
};

export function formatProcessamentoEventoLabel(evento: string): string {
  return EVENTO_LABEL[evento] ?? evento.replaceAll("_", " ");
}

export function serproProcuracaoSituacaoLabel(situacao: string | undefined): string {
  const map: Record<string, string> = {
    valida: "Válida (SERPRO)",
    expirada: "Expirada (SERPRO)",
    inexistente: "Inexistente (SERPRO)",
    erro_serpro: "Erro SERPRO",
    nao_validada: "Não validada"
  };
  return map[situacao ?? ""] ?? "Não validada";
}

export function certificadoExpiringBannerMessage(daysLeft: number, label: string): string {
  return `Certificado "${label}" expira em ${daysLeft} dia(s). Renove antes da transmissão PGDASD.`;
}

/** EXEQ-FISC-074 — histórico e central de erros */

export type ProcessamentoRowLike = {
  id: string;
  portal_cliente_id: string;
  competencia: string;
  status: string;
  erro_codigo?: string | null;
  protocolo_serpro?: string | null;
  created_at?: string;
};

export type ProcessamentoListFilters = {
  competencia?: string;
  portalClienteId?: string;
  status?: string;
  somenteComErro?: boolean;
};

export const PROCESSAMENTO_STATUS_FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "Todos os status" },
  { value: "VALIDADO", label: "Validado" },
  { value: "TRANSMITINDO", label: "Transmitindo" },
  { value: "TRANSMITIDA", label: "Transmitida" },
  { value: "RECIBO_OK", label: "Recibo disponível" },
  { value: "EMITINDO_DAS", label: "Emitindo DAS" },
  { value: "CONCLUIDO", label: "Concluído" },
  { value: "ERRO", label: "Erro" }
];

export function processamentoTemErro(row: Pick<ProcessamentoRowLike, "status" | "erro_codigo">): boolean {
  return row.status === "ERRO" || Boolean(row.erro_codigo?.trim());
}

export function filterProcessamentoRows<T extends ProcessamentoRowLike>(
  rows: T[],
  filters: ProcessamentoListFilters
): T[] {
  return rows.filter((row) => {
    if (filters.competencia && row.competencia !== filters.competencia) {
      return false;
    }
    if (filters.portalClienteId && row.portal_cliente_id !== filters.portalClienteId) {
      return false;
    }
    if (filters.status && row.status !== filters.status) {
      return false;
    }
    if (filters.somenteComErro && !processamentoTemErro(row)) {
      return false;
    }
    return true;
  });
}

export type ProcessamentoErroGroup = {
  codigo: string;
  titulo: string;
  sugestao: string;
  count: number;
  processamentos: Array<{
    id: string;
    competencia: string;
    portal_cliente_id: string;
  }>;
};

export function groupProcessamentosByErro<T extends ProcessamentoRowLike>(rows: T[]): ProcessamentoErroGroup[] {
  const comErro = rows.filter(processamentoTemErro);
  const byCodigo = new Map<string, T[]>();

  for (const row of comErro) {
    const codigo = row.erro_codigo?.trim() || (row.status === "ERRO" ? "ERRO_DESCONHECIDO" : "ERRO_PARCIAL");
    const list = byCodigo.get(codigo) ?? [];
    list.push(row);
    byCodigo.set(codigo, list);
  }

  return [...byCodigo.entries()]
    .map(([codigo, items]) => {
      const help = processamentoErroHelp(codigo === "ERRO_DESCONHECIDO" ? null : codigo);
      return {
        codigo,
        titulo: help.titulo,
        sugestao: help.sugestao,
        count: items.length,
        processamentos: items.map((p) => ({
          id: p.id,
          competencia: p.competencia,
          portal_cliente_id: p.portal_cliente_id
        }))
      };
    })
    .sort((a, b) => b.count - a.count || a.titulo.localeCompare(b.titulo, "pt-BR"));
}

export function processamentoErroSuggestedAction(
  codigo: string | null | undefined
): { to: string; label: string } | null {
  const c = (codigo ?? "").toUpperCase();
  if (c.includes("CERT")) {
    return { to: "/fiscal/certificados", label: "Abrir Certificados A1" };
  }
  if (c.startsWith("PROCURACAO") || c === "TRANSMISSAO_FALHOU" || c === "SERPRO_ERRO") {
    return { to: "/fiscal/procuracoes", label: "Abrir Procurações" };
  }
  return null;
}

export function countProcessamentosComErro<T extends ProcessamentoRowLike>(rows: T[]): number {
  return rows.filter(processamentoTemErro).length;
}
