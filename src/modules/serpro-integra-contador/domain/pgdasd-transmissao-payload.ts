import type { CanonicalApuracao } from "../../fiscal-ingestion/domain/canonical-apuracao.schema";
import { ANEXO_VALUES } from "../../fiscal-ingestion/domain/canonical-apuracao.schema";

/** Códigos de tributo PGDASD (Integra Contador — valoresParaComparacao). */
export const PGDASD_CODIGO_TRIBUTO = {
  cpp: 1001,
  icms: 1004,
  iss: 1005,
  pis: 1006,
  cofins: 1007,
  irpj: 1002,
  csll: 1010
} as const;

/** idAtividade PGDASD representativo por anexo (MVP CSV v1). */
export const PGDASD_ANEXO_ID_ATIVIDADE: Record<(typeof ANEXO_VALUES)[number], number> = {
  ANEXO_I: 1,
  ANEXO_II: 2,
  ANEXO_III: 10,
  ANEXO_IV: 12,
  ANEXO_V: 14
};

export type PgdasdTransmissaoOptions = {
  /** 1 = original, 2 = retificadora (default 1). */
  tipoDeclaracao?: 1 | 2;
  /** true = transmite; false = apenas calcula (default true). */
  indicadorTransmissao?: boolean;
  /** true = exige valoresParaComparacao batendo com cálculo SERPRO (default false). */
  indicadorComparacao?: boolean;
};

export type PgdasdTransmissaoDados = {
  cnpjCompleto: string;
  pa: number;
  indicadorTransmissao: boolean;
  indicadorComparacao: boolean;
  declaracao: {
    tipoDeclaracao: number;
    receitaPaCompetenciaInterno: number;
    receitaPaCompetenciaExterno: number;
    estabelecimentos: Array<{
      cnpjCompleto: string;
      atividades?: Array<{
        idAtividade: number;
        valorAtividade: number;
        receitasAtividade: Array<{ valor: number }>;
      }>;
    }>;
  };
  valoresParaComparacao?: Array<{ codigoTributo: number; valor: number }>;
};

function competenciaToPa(competencia: string): number {
  const digits = competencia.replace(/\D/g, "");
  if (digits.length !== 6) {
    throw new Error(`PGDASD_PA_INVALIDO — competencia ${competencia} deve ser YYYY-MM.`);
  }
  const mes = Number(digits.slice(4, 6));
  if (mes < 1 || mes > 12) {
    throw new Error(`PGDASD_PA_INVALIDO — mes invalido em competencia ${competencia}.`);
  }
  return Number(digits);
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function buildValoresParaComparacao(apuracao: CanonicalApuracao): Array<{ codigoTributo: number; valor: number }> {
  const items: Array<{ codigoTributo: number; valor: number }> = [];
  const { tributos } = apuracao;
  if (tributos.inss > 0) {
    items.push({ codigoTributo: PGDASD_CODIGO_TRIBUTO.cpp, valor: roundMoney(tributos.inss) });
  }
  if (tributos.icms > 0) {
    items.push({ codigoTributo: PGDASD_CODIGO_TRIBUTO.icms, valor: roundMoney(tributos.icms) });
  }
  if (tributos.iss > 0) {
    items.push({ codigoTributo: PGDASD_CODIGO_TRIBUTO.iss, valor: roundMoney(tributos.iss) });
  }
  if (tributos.pisCofins > 0) {
    const half = roundMoney(tributos.pisCofins / 2);
    items.push({ codigoTributo: PGDASD_CODIGO_TRIBUTO.pis, valor: half });
    items.push({ codigoTributo: PGDASD_CODIGO_TRIBUTO.cofins, valor: half });
  }
  return items;
}

/** Monta objeto `dados` de TRANSDECLARACAO11 a partir do modelo canônico CSV. */
export function buildPgdasdTransmissaoDadosFromApuracao(
  apuracao: CanonicalApuracao,
  options: PgdasdTransmissaoOptions = {}
): PgdasdTransmissaoDados {
  const cnpj = apuracao.cnpj.replace(/\D/g, "");
  if (cnpj.length !== 14) {
    throw new Error("PGDASD_CNPJ_INVALIDO — CNPJ deve ter 14 digitos.");
  }

  const indicadorTransmissao = options.indicadorTransmissao ?? true;
  const indicadorComparacao = options.indicadorComparacao ?? false;
  const receita = roundMoney(apuracao.receitaBrutaMes);
  const idAtividade = PGDASD_ANEXO_ID_ATIVIDADE[apuracao.anexo];

  const dados: PgdasdTransmissaoDados = {
    cnpjCompleto: cnpj,
    pa: competenciaToPa(apuracao.competencia),
    indicadorTransmissao,
    indicadorComparacao,
    declaracao: {
      tipoDeclaracao: options.tipoDeclaracao ?? 1,
      receitaPaCompetenciaInterno: receita,
      receitaPaCompetenciaExterno: 0,
      estabelecimentos: [
        {
          cnpjCompleto: cnpj,
          atividades: [
            {
              idAtividade,
              valorAtividade: receita,
              receitasAtividade: [{ valor: receita }]
            }
          ]
        }
      ]
    }
  };

  if (indicadorComparacao) {
    const valores = buildValoresParaComparacao(apuracao);
    if (valores.length > 0) {
      dados.valoresParaComparacao = valores;
    }
  }

  return dados;
}

export function parsePgdasdPedidoDados(raw: string): PgdasdTransmissaoDados {
  return JSON.parse(raw) as PgdasdTransmissaoDados;
}
