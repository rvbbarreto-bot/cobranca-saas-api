import type { CanonicalApuracao } from "../../src/modules/fiscal-ingestion/domain/canonical-apuracao.schema";

/** Apuração canônica mínima para testes SERPRO/PGDASD. */
export function sampleCanonicalApuracao(overrides: Partial<CanonicalApuracao> = {}): CanonicalApuracao {
  return {
    cnpj: "00000000000191",
    competencia: "2026-05",
    receitaBrutaMes: 85000,
    regime: "SIMPLES",
    anexo: "ANEXO_III",
    tributos: {
      inss: 1200,
      icms: 0,
      iss: 850,
      pisCofins: 0
    },
    valorTotalDas: 2050,
    ...overrides
  };
}
