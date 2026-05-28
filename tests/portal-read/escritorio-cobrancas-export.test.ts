import { describe, expect, it, vi } from "vitest";
import {
  CSV_EXPORT_HEADERS,
  escapeCsvCell,
  formatCsvRow,
  formatCurrencyBr,
  formatDateBr,
  maskDocumentoForCsv,
  streamCobrancasCsvRows
} from "../../src/modules/portal-read/application/escritorio-cobrancas-export";
import { canExportEscritorioCobrancas } from "../../src/modules/portal-read/interfaces/http/escritorio-router";
import type { Request } from "express";

const tenantId = "00000000-0000-4000-8000-000000000001";

function sampleRow(id: string) {
  return {
    id,
    created_at: new Date("2026-05-01T10:00:00.000Z"),
    due_date: "2026-06-15",
    paid_at: null,
    canonical_status: "pendente_pagamento",
    amount: "1500.50",
    description: "Ref 1",
    type: "boleto",
    cliente_nome: "Cliente Teste",
    cliente_documento: "12345678901",
    boleto_barcode: "12345",
    gateway_transaction_id: "gw-1"
  };
}

describe("escritorio cobrancas export", () => {
  it("headers na ordem do contrato", () => {
    expect(CSV_EXPORT_HEADERS).toEqual([
      "id",
      "created_at",
      "due_date",
      "paid_at",
      "canonical_status",
      "amount",
      "description",
      "type",
      "cliente_nome",
      "cliente_documento_mascarado",
      "boleto_barcode",
      "gateway_transaction_id"
    ]);
  });

  it("mascara documento (***xxxx)", () => {
    expect(maskDocumentoForCsv("12345678901")).toBe("***8901");
    expect(maskDocumentoForCsv("12345678901")).not.toContain("1234567");
  });

  it("formata data DD/MM/YYYY e valor em BRL", () => {
    expect(formatDateBr("2026-05-18")).toBe("18/05/2026");
    expect(formatCurrencyBr("1500.5")).toMatch(/R\$\s*1\.500,50/);
  });

  it("CSV com header + 3 linhas de dados", async () => {
    let fetchCalls = 0;
    const query = vi.fn(async (sql: string) => {
      if (sql === "BEGIN" || sql === "COMMIT" || sql.startsWith("CLOSE") || sql.startsWith("DECLARE")) {
        return { rows: [] };
      }
      if (sql.startsWith("FETCH")) {
        fetchCalls += 1;
        if (fetchCalls === 1) {
          return {
            rows: [sampleRow("c1"), sampleRow("c2"), sampleRow("c3")]
          };
        }
        return { rows: [] };
      }
      if (sql === "ROLLBACK") return { rows: [] };
      return { rows: [] };
    });

    const chunks: string[] = [];
    for await (const chunk of streamCobrancasCsvRows({ query } as never, tenantId, {})) {
      chunks.push(chunk);
    }
    const csv = chunks.join("");
    const lines = csv.trim().split("\n");

    expect(lines).toHaveLength(4);
    expect(lines[0]).toBe(CSV_EXPORT_HEADERS.join(","));
    expect(lines[1]).toContain("c1");
    expect(lines[1]).toContain("***8901");
    expect(lines[1]).not.toContain("12345678901");
  });

  it("escapa vírgulas e aspas", () => {
    expect(escapeCsvCell('valor, com "aspas"')).toBe('"valor, com ""aspas"""');
  });

  it("aplica filtro de datas no DECLARE do cursor", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql === "BEGIN" || sql === "COMMIT" || sql.startsWith("CLOSE") || sql.startsWith("DECLARE")) {
        return { rows: [] };
      }
      if (sql.startsWith("FETCH")) {
        return { rows: [] };
      }
      return { rows: [] };
    });

    const chunks: string[] = [];
    for await (const chunk of streamCobrancasCsvRows({ query } as never, tenantId, {
      dataInicio: "2026-05-01",
      dataFim: "2026-05-31"
    })) {
      chunks.push(chunk);
    }

    const declareCall = query.mock.calls.find(
      (call) => typeof call[0] === "string" && call[0].includes("DECLARE cobrancas_export_cur")
    );
    expect(declareCall?.[0]).toContain("created_at::date BETWEEN");
    expect(declareCall?.[1]).toEqual([tenantId, "2026-05-01", "2026-05-31"]);
  });

  it("stream em lotes via cursor (FETCH repetido até vazio)", async () => {
    let fetchCalls = 0;
    const query = vi.fn(async (sql: string) => {
      if (sql === "BEGIN" || sql === "COMMIT" || sql.startsWith("CLOSE") || sql.startsWith("DECLARE")) {
        return { rows: [] };
      }
      if (sql.startsWith("FETCH")) {
        fetchCalls += 1;
        if (fetchCalls === 1) return { rows: [sampleRow("a")] };
        return { rows: [] };
      }
      return { rows: [] };
    });

    const chunks: string[] = [];
    for await (const chunk of streamCobrancasCsvRows({ query } as never, tenantId, {})) {
      chunks.push(chunk);
    }
    expect(fetchCalls).toBeGreaterThanOrEqual(1);
    expect(
      query.mock.calls.some(
        (call) => typeof call[0] === "string" && call[0].includes("DECLARE cobrancas_export_cur")
      )
    ).toBe(true);
    expect(query.mock.calls.some((call) => call[0] === "FETCH 500 FROM cobrancas_export_cur")).toBe(
      true
    );
  });
});

describe("canExportEscritorioCobrancas", () => {
  const base = {
    authContext: { userId: "u1", tenantId: "t1", roles: ["owner" as const] },
    portalMembership: { role: "admin_escritorio" as const, cpfCnpjCliente: null }
  };

  it("operador → negado", () => {
    const req = {
      ...base,
      portalMembership: { role: "operador" as const, cpfCnpjCliente: null }
    } as Request;
    expect(canExportEscritorioCobrancas(req)).toBe(false);
  });

  it("admin_escritorio e owner → permitido", () => {
    expect(canExportEscritorioCobrancas(base as Request)).toBe(true);
    expect(
      canExportEscritorioCobrancas({
        ...base,
        portalMembership: undefined,
        authContext: { ...base.authContext, roles: ["owner"] }
      } as Request)
    ).toBe(true);
  });
});
