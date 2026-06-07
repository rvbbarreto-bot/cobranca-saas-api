/** Registro de adapters de ingestão — MVP: CSV; Fase 2: Excel/API/ERP (EXEQ-FISC-033 stub). */
import type { IngestionAdapter } from "../domain/ingestion-adapter.interface";
import { csvIngestionAdapter } from "../domain/csv-ingestion-adapter";

export type IngestionSourceType = IngestionAdapter["sourceType"];

const adapters: Record<IngestionSourceType, IngestionAdapter> = {
  csv: csvIngestionAdapter,
  excel: {
    sourceType: "excel",
    parse() {
      throw new Error("INGESTAO_EXCEL_NAO_IMPLEMENTADA — Fase 2");
    }
  },
  api: {
    sourceType: "api",
    parse() {
      throw new Error("INGESTAO_API_NAO_IMPLEMENTADA — Fase 2");
    }
  }
};

export function getIngestionAdapter(source: IngestionSourceType): IngestionAdapter {
  return adapters[source];
}
