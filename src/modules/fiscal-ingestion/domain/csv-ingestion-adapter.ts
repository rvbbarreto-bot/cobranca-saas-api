import {
  ANEXO_VALUES,
  canonicalApuracaoSchema,
  isCompetenciaTooFarFuture,
  normalizeCnpj,
  parseDecimal,
  validateDasTotalTolerance,
  type CanonicalApuracao,
  type IngestLineError
} from "./canonical-apuracao.schema";
import type { IngestionAdapter, IngestParseResult } from "./ingestion-adapter.interface";

const REQUIRED_COLUMNS = [
  "cnpj",
  "competencia",
  "receita_bruta_mes",
  "regime_tributario",
  "anexo",
  "valor_inss",
  "valor_icms",
  "valor_iss",
  "valor_pis_cofins",
  "valor_total_das"
] as const;

function splitCsvLine(line: string): string[] {
  return line.split(",").map((c) => c.trim());
}

function lineError(linha: number, campo: string, codigo: string, mensagem: string): IngestLineError {
  return { linha, campo, codigo, mensagem };
}

export class CsvIngestionAdapter implements IngestionAdapter {
  readonly sourceType = "csv" as const;

  parse(content: string | Buffer): IngestParseResult {
    const text = (typeof content === "string" ? content : content.toString("utf8")).replace(/^\uFEFF/, "");
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

    if (lines.length < 2) {
      return {
        rows: [],
        errors: [lineError(1, "arquivo", "CSV_VAZIO", "CSV deve conter header e ao menos uma linha de dados.")],
        rowCount: 0
      };
    }

    const header = splitCsvLine(lines[0]!).map((h) => h.toLowerCase());
    const missing = REQUIRED_COLUMNS.filter((c) => !header.includes(c));
    if (missing.length > 0) {
      return {
        rows: [],
        errors: [
          lineError(
            1,
            "header",
            "HEADER_INCOMPLETO",
            `Colunas obrigatorias ausentes: ${missing.join(", ")}`
          )
        ],
        rowCount: 0
      };
    }

    const idx = (name: string) => header.indexOf(name);

    const rows: CanonicalApuracao[] = [];
    const errors: IngestLineError[] = [];
    const seen = new Set<string>();

    for (let i = 1; i < lines.length; i++) {
      const linha = i + 1;
      const cols = splitCsvLine(lines[i]!);
      const get = (name: string) => cols[idx(name)] ?? "";

      const cnpj = normalizeCnpj(get("cnpj"));
      const competencia = get("competencia").trim();
      const receita = parseDecimal(get("receita_bruta_mes"));
      const regime = get("regime_tributario").trim().toUpperCase();
      const anexo = get("anexo").trim().toUpperCase();
      const inss = parseDecimal(get("valor_inss"));
      const icms = parseDecimal(get("valor_icms"));
      const iss = parseDecimal(get("valor_iss"));
      const pisCofins = parseDecimal(get("valor_pis_cofins"));
      const totalDas = parseDecimal(get("valor_total_das"));

      if (receita === null) {
        errors.push(lineError(linha, "receita_bruta_mes", "VALOR_INVALIDO", "Receita bruta invalida."));
        continue;
      }
      if ([inss, icms, iss, pisCofins, totalDas].some((v) => v === null)) {
        errors.push(lineError(linha, "tributos", "VALOR_INVALIDO", "Valor tributario invalido."));
        continue;
      }

      const candidate = {
        cnpj,
        competencia,
        receitaBrutaMes: receita,
        regime,
        anexo,
        tributos: {
          inss: inss!,
          icms: icms!,
          iss: iss!,
          pisCofins: pisCofins!
        },
        valorTotalDas: totalDas!,
        metadata: {
          razaoSocial: get("razao_social") || undefined,
          observacao: get("observacao") || undefined,
          idExternoErp: get("id_externo_erp") || undefined
        }
      };

      const parsed = canonicalApuracaoSchema.safeParse({
        ...candidate,
        regime: candidate.regime === "SIMPLES" ? "SIMPLES" : candidate.regime
      });

      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        errors.push(
          lineError(
            linha,
            issue?.path.join(".") || "linha",
            "VALIDACAO_CANONICA",
            issue?.message ?? "Linha invalida."
          )
        );
        continue;
      }

      if (!ANEXO_VALUES.includes(parsed.data.anexo)) {
        errors.push(lineError(linha, "anexo", "ANEXO_INVALIDO", "Anexo invalido."));
        continue;
      }

      if (isCompetenciaTooFarFuture(parsed.data.competencia)) {
        errors.push(
          lineError(linha, "competencia", "COMPETENCIA_FUTURA", "Competencia além do limite permitido.")
        );
        continue;
      }

      if (!validateDasTotalTolerance(parsed.data)) {
        errors.push(
          lineError(
            linha,
            "valor_total_das",
            "TOTAL_DAS_DIVERGENTE",
            "valor_total_das diverge da soma dos tributos (tolerancia R$ 0,02)."
          )
        );
        continue;
      }

      const dedupe = `${parsed.data.cnpj}:${parsed.data.competencia}`;
      if (seen.has(dedupe)) {
        errors.push(
          lineError(linha, "competencia", "DUPLICATA", "CNPJ + competencia duplicados no arquivo.")
        );
        continue;
      }
      seen.add(dedupe);

      rows.push({ ...parsed.data, metadata: { ...parsed.data.metadata, sourceLine: linha } });
    }

    return { rows, errors, rowCount: lines.length - 1 };
  }
}

export const csvIngestionAdapter = new CsvIngestionAdapter();
