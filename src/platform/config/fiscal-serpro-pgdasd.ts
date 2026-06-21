import type { PgdasdTransmissaoOptions } from "../../modules/serpro-integra-contador/domain/pgdasd-transmissao-payload";

/** Opções PGDASD TRANSDECLARACAO11 via env (homolog/demo). */
export function serproPgdasdTransmissaoOptionsFromEnv(): PgdasdTransmissaoOptions {
  const simular = process.env.FISCAL_SERPRO_PGDASD_SIMULAR?.trim().toLowerCase();
  const comparar = process.env.FISCAL_SERPRO_PGDASD_COMPARAR?.trim().toLowerCase();
  return {
    indicadorTransmissao: simular === "true" || simular === "1" ? false : true,
    indicadorComparacao: comparar === "true" || comparar === "1"
  };
}
