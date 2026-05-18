import { describe, expect, it } from "vitest";
import {
  CSV_EXPORT_HEADERS,
  escapeCsvCell,
  formatCsvRow,
  maskDocumentoForCsv
} from "../../src/modules/portal-read/application/escritorio-cobrancas-export";

describe("escritorio cobrancas export", () => {
  it("headers na ordem esperada", () => {
    expect(CSV_EXPORT_HEADERS[0]).toBe("id");
    expect(CSV_EXPORT_HEADERS).toContain("numero_nfse");
  });

  it("mascara documento", () => {
    expect(maskDocumentoForCsv("12345678901")).toBe("***8901");
  });

  it("CSV com header + 3 linhas de dados", () => {
    const header = formatCsvRow(["a", "b"]);
    const row = formatCsvRow(["1", "2"]);
    const csv = header + row + row + row;
    const lines = csv.trim().split("\n");
    expect(lines).toHaveLength(4);
  });

  it("escapa vírgulas e aspas", () => {
    expect(escapeCsvCell('valor, com "aspas"')).toBe('"valor, com ""aspas"""');
  });
});
