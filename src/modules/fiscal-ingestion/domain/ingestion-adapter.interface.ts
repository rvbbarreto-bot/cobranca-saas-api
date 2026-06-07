import type { CanonicalApuracao, IngestLineError } from "./canonical-apuracao.schema";

export type IngestParseResult = {
  rows: CanonicalApuracao[];
  errors: IngestLineError[];
  rowCount: number;
};

export interface IngestionAdapter {
  readonly sourceType: "csv" | "excel" | "api";
  parse(content: string | Buffer): IngestParseResult;
}
