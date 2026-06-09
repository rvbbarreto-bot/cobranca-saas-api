export type SerproProcuracaoSituacao = "valida" | "expirada" | "inexistente" | "erro_serpro" | "nao_validada";

export function serproProcuracaoUserMessage(situacao: SerproProcuracaoSituacao): string {
  const map: Record<SerproProcuracaoSituacao, string> = {
    valida: "Procuração válida na Receita Federal.",
    expirada:
      "Procuração expirada no e-CAC. Renove a procuração e valide novamente antes de transmitir.",
    inexistente:
      "Procuração não encontrada na Receita Federal. Verifique o CPF/CNPJ do procurador e o vínculo no e-CAC.",
    erro_serpro:
      "Não foi possível consultar a procuração na SERPRO. Tente novamente ou contate o suporte Exeq.",
    nao_validada: "Execute a validação SERPRO da procuração antes de transmitir declarações."
  };
  return map[situacao];
}

export function parseSerproProcuracaoSituacao(rawBody: unknown): SerproProcuracaoSituacao {
  if (typeof rawBody !== "object" || rawBody === null) {
    return "erro_serpro";
  }
  const body = rawBody as Record<string, unknown>;
  if (body.mock === true && body.situacao === "valida") {
    return "valida";
  }
  const situacao =
    typeof body.situacao === "string"
      ? body.situacao.toLowerCase()
      : typeof body.situacaoProcuracao === "string"
        ? body.situacaoProcuracao.toLowerCase()
        : "";
  if (situacao.includes("valid") || situacao === "ativa") return "valida";
  if (situacao.includes("expir") || situacao === "vencida") return "expirada";
  if (situacao.includes("inexist") || situacao.includes("nao_encontr") || situacao === "ausente") {
    return "inexistente";
  }
  if (body.mock === true) {
    return "valida";
  }
  return "erro_serpro";
}
