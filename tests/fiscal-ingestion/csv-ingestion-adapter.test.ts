import { describe, expect, it } from "vitest";
import { csvIngestionAdapter } from "../../src/modules/fiscal-ingestion/domain/csv-ingestion-adapter";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const TEMPLATE = readFileSync(
  join(process.cwd(), "docs/templates/pgdasd-import-v1.csv"),
  "utf8"
);

describe("CsvIngestionAdapter", () => {
  it("parse template v1 valido", () => {
    const result = csvIngestionAdapter.parse(TEMPLATE);
    expect(result.errors).toHaveLength(0);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.cnpj).toBe("00000000000191");
    expect(result.rows[0]?.competencia).toBe("2026-05");
  });

  it("rejeita header incompleto", () => {
    const result = csvIngestionAdapter.parse("cnpj,competencia\n123,2026-05");
    expect(result.rows).toHaveLength(0);
    expect(result.errors[0]?.codigo).toBe("HEADER_INCOMPLETO");
  });

  it("rejeita total DAS divergente", () => {
    const csv = `cnpj,competencia,receita_bruta_mes,regime_tributario,anexo,valor_inss,valor_icms,valor_iss,valor_pis_cofins,valor_total_das
00000000000191,2026-05,1000.00,SIMPLES,ANEXO_III,100.00,0.00,50.00,0.00,9999.00`;
    const result = csvIngestionAdapter.parse(csv);
    expect(result.rows).toHaveLength(0);
    expect(result.errors.some((e) => e.codigo === "TOTAL_DAS_DIVERGENTE")).toBe(true);
  });
});
