import { describe, expect, it, vi } from "vitest";
import {
  emptyEscritorioDashboard,
  getEscritorioDashboard,
  resolveDashboardPeriod
} from "../../src/modules/portal-read/application/escritorio-dashboard";
import { canReadEscritorioDashboard } from "../../src/modules/portal-read/interfaces/http/escritorio-router";
import type { Request } from "express";

const tenantA = "00000000-0000-4000-8000-000000000001";
const tenantB = "00000000-0000-4000-8000-000000000002";

describe("resolveDashboardPeriod", () => {
  it("periodo 7d calcula inicio relativo ao fim", () => {
    const p = resolveDashboardPeriod({ periodo: "7d", dataFim: "2026-05-18" });
    expect(p.fim).toBe("2026-05-18");
    expect(p.inicio).toBe("2026-05-12");
  });

  it("custom usa datas informadas", () => {
    const p = resolveDashboardPeriod({
      periodo: "custom",
      dataInicio: "2026-01-01",
      dataFim: "2026-01-31"
    });
    expect(p.inicio).toBe("2026-01-01");
    expect(p.fim).toBe("2026-01-31");
  });

  it("default periodo 30d quando omitido", () => {
    const p = resolveDashboardPeriod({ dataFim: "2026-05-18" });
    expect(p.fim).toBe("2026-05-18");
    expect(p.inicio).toBe("2026-04-19");
  });
});

describe("getEscritorioDashboard", () => {
  it("periodo 30d retorna objeto com todos os campos do contrato", async () => {
    const period = resolveDashboardPeriod({ periodo: "30d", dataFim: "2026-05-18" });
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("cobrancas_periodo AS")) {
        return {
          rows: [
            {
              total: "10",
              rascunho: "1",
              emitida: "2",
              enviada: "1",
              pendente_pagamento: "2",
              paga: "3",
              vencida: "1",
              cancelada: "0",
              erro_emissao: "0",
              valor_emitido: "5000.00",
              valor_recebido: "3000.00",
              valor_vencido: "500.00"
            }
          ]
        };
      }
      if (sql.includes("status = 'sent'") && sql.includes("channel IN")) {
        return {
          rows: [
            { channel: "email", cnt: "4" },
            { channel: "whatsapp", cnt: "2" }
          ]
        };
      }
      if (sql.includes("status IN ('sent', 'failed')")) {
        return {
          rows: [
            { status: "sent", cnt: "6" },
            { status: "failed", cnt: "1" }
          ]
        };
      }
      if (sql.includes("GROUP BY cli.id")) {
        return {
          rows: [
            {
              nome: "Cliente A",
              documento: "12345678901",
              valor_vencido: "500.00",
              qtd: "2"
            }
          ]
        };
      }
      return { rows: [] };
    });

    const dash = await getEscritorioDashboard({ query } as never, tenantA, period);

    expect(dash.periodo).toEqual(period);
    expect(dash.cobrancas.total).toBe(10);
    expect(dash.cobrancas.por_status).toEqual({
      rascunho: 1,
      emitida: 2,
      enviada: 1,
      pendente_pagamento: 2,
      paga: 3,
      vencida: 1,
      cancelada: 0,
      erro_emissao: 0
    });
    expect(dash.cobrancas.valor_total_emitido).toBe(5000);
    expect(dash.cobrancas.valor_total_recebido).toBe(3000);
    expect(dash.cobrancas.valor_total_vencido).toBe(500);
    expect(dash.cobrancas.taxa_conversao).toBe(33.33);
    expect(dash.notificacoes).toEqual({
      total_enviadas: 6,
      total_falhas: 1,
      por_canal: { email: 4, whatsapp: 2 }
    });
    expect(dash.top_clientes_inadimplentes).toEqual([
      {
        nome: "Cliente A",
        documento_mascarado: "***8901",
        valor_vencido: 500,
        qtd_cobr_vencidas: 2
      }
    ]);
    expect(dash).not.toHaveProperty("nfse");
  });

  it("sem cobranças no período retorna zeros (não null/404)", async () => {
    const period = { inicio: "2026-01-01", fim: "2026-01-31" };
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("cobrancas_periodo AS")) {
        return {
          rows: [
            {
              total: "0",
              rascunho: "0",
              emitida: "0",
              enviada: "0",
              pendente_pagamento: "0",
              paga: "0",
              vencida: "0",
              cancelada: "0",
              erro_emissao: "0",
              valor_emitido: "0",
              valor_recebido: "0",
              valor_vencido: "0"
            }
          ]
        };
      }
      return { rows: [] };
    });

    const dash = await getEscritorioDashboard({ query } as never, tenantA, period);
    const empty = emptyEscritorioDashboard(period);

    expect(dash.cobrancas).toEqual(empty.cobrancas);
    expect(dash.notificacoes).toEqual(empty.notificacoes);
    expect(dash.top_clientes_inadimplentes).toEqual([]);
  });

  it("cross-tenant: consultas usam apenas o tenantId informado", async () => {
    const period = { inicio: "2026-05-01", fim: "2026-05-18" };
    const zeroCob = {
      total: "0",
      rascunho: "0",
      emitida: "0",
      enviada: "0",
      pendente_pagamento: "0",
      paga: "0",
      vencida: "0",
      cancelada: "0",
      erro_emissao: "0",
      valor_emitido: "0",
      valor_recebido: "0",
      valor_vencido: "0"
    };
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("cobrancas_periodo AS")) {
        return { rows: [zeroCob] };
      }
      return { rows: [] };
    });

    await getEscritorioDashboard({ query } as never, tenantA, period);
    await getEscritorioDashboard({ query } as never, tenantB, period);

    const tenantParams = query.mock.calls.map((call) => call[1]?.[0]);
    expect(tenantParams.filter((t) => t === tenantA).length).toBeGreaterThan(0);
    expect(tenantParams.filter((t) => t === tenantB).length).toBeGreaterThan(0);
    expect(tenantParams).not.toContain(undefined);
  });
});

describe("canReadEscritorioDashboard", () => {
  const baseReq = {
    portalMembership: { role: "operador" as const, cpfCnpjCliente: null },
    authContext: { userId: "u1", tenantId: "t1", roles: ["owner" as const] }
  };

  it("role viewer no JWT → 403", () => {
    const req = {
      ...baseReq,
      authContext: { ...baseReq.authContext, roles: ["viewer" as const] }
    } as Request;
    expect(canReadEscritorioDashboard(req)).toBe(false);
  });

  it("operador e admin_escritorio podem ler", () => {
    expect(
      canReadEscritorioDashboard({
        ...baseReq,
        portalMembership: { role: "operador", cpfCnpjCliente: null }
      } as Request)
    ).toBe(true);
    expect(
      canReadEscritorioDashboard({
        ...baseReq,
        portalMembership: { role: "admin_escritorio", cpfCnpjCliente: null }
      } as Request)
    ).toBe(true);
  });
});
