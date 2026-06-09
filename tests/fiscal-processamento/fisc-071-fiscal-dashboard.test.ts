import { describe, expect, it, vi } from "vitest";
import {
  currentCompetenciaRef,
  getProcessamentoDashboardStats
} from "../../src/modules/fiscal-processamento/infrastructure/processamento-fiscal-repository";

describe("currentCompetenciaRef (EXEQ-FISC-071)", () => {
  it("formata YYYY-MM no fuso local", () => {
    expect(currentCompetenciaRef(new Date(2026, 5, 15))).toBe("2026-06");
    expect(currentCompetenciaRef(new Date(2025, 11, 1))).toBe("2025-12");
  });
});

describe("getProcessamentoDashboardStats", () => {
  it("agrega contagens por competência e erros", async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("COUNT(*)")) {
        return { rows: [{ processamentos_mes: "3", erros_abertos: "1" }] };
      }
      return {
        rows: [
          {
            id: "p1",
            organization_id: "org1",
            automacao_tenant_id: "t1",
            portal_cliente_id: "c1",
            fiscal_ingest_id: null,
            competencia: "2026-06",
            tipo: "PGDASD_APURACAO",
            status: "CONCLUIDO",
            valor_apurado: "100",
            protocolo_serpro: null,
            recibo_storage_key: null,
            guia_fiscal_id: null,
            erro_codigo: null,
            correlation_id: null,
            created_at: new Date("2026-06-01T00:00:00Z"),
            updated_at: new Date("2026-06-01T00:00:00Z")
          }
        ]
      };
    });
    const db = { query } as unknown as import("pg").Pool;

    const stats = await getProcessamentoDashboardStats(db, "t1", "2026-06");
    expect(stats.processamentosMes).toBe(3);
    expect(stats.errosAbertos).toBe(1);
    expect(stats.ultimosProcessamentos).toHaveLength(1);
    expect(stats.competenciaAtual).toBe("2026-06");
  });
});
