import type { PoolClient } from "pg";

export type DashboardPeriod = {
  inicio: string;
  fim: string;
};

export type EscritorioDashboard = {
  periodo: DashboardPeriod;
  cobrancas: {
    total: number;
    por_status: Record<string, number>;
    valor_total_emitido: number;
    valor_total_recebido: number;
    valor_total_vencido: number;
    taxa_conversao: number;
  };
  notificacoes: {
    total_enviadas: number;
    total_falhas: number;
    por_canal: { email: number; whatsapp: number };
  };
  nfse: {
    total_autorizadas: number;
    total_erro: number;
  };
  top_clientes_inadimplentes: Array<{
    nome: string;
    documento_mascarado: string;
    valor_vencido: number;
    qtd_cobr_vencidas: number;
  }>;
};

function maskDocumento(doc: string): string {
  const d = doc.replace(/\D/g, "");
  if (d.length < 4) return "***";
  return `***${d.slice(-4)}`;
}

export function resolveDashboardPeriod(input: {
  periodo?: string;
  dataInicio?: string;
  dataFim?: string;
}): DashboardPeriod {
  const now = new Date();
  const fim = input.dataFim?.trim() || now.toISOString().slice(0, 10);
  let inicio = input.dataInicio?.trim();
  if (!inicio) {
    const days =
      input.periodo === "7d" ? 7 : input.periodo === "90d" ? 90 : input.periodo === "custom" ? 30 : 30;
    const d = new Date(fim);
    d.setUTCDate(d.getUTCDate() - days + 1);
    inicio = d.toISOString().slice(0, 10);
  }
  return { inicio, fim };
}

export async function getEscritorioDashboard(
  client: PoolClient,
  tenantId: string,
  period: DashboardPeriod
): Promise<EscritorioDashboard> {
  const cob = await client.query<{
    total: string;
    rascunho: string;
    emitida: string;
    enviada: string;
    pendente_pagamento: string;
    paga: string;
    vencida: string;
    cancelada: string;
    erro_emissao: string;
    valor_emitido: string | null;
    valor_recebido: string | null;
    valor_vencido: string | null;
  }>(
    `WITH periodo AS (
       SELECT $2::date AS inicio, $3::date AS fim
     ),
     cobrancas_periodo AS (
       SELECT * FROM charges
       WHERE tenant_id = $1::uuid
         AND created_at::date BETWEEN (SELECT inicio FROM periodo) AND (SELECT fim FROM periodo)
     )
     SELECT
       COUNT(*)::text AS total,
       COUNT(*) FILTER (WHERE canonical_status = 'rascunho')::text AS rascunho,
       COUNT(*) FILTER (WHERE canonical_status = 'emitida')::text AS emitida,
       COUNT(*) FILTER (WHERE canonical_status = 'enviada')::text AS enviada,
       COUNT(*) FILTER (WHERE canonical_status = 'pendente_pagamento')::text AS pendente_pagamento,
       COUNT(*) FILTER (WHERE canonical_status = 'paga')::text AS paga,
       COUNT(*) FILTER (WHERE canonical_status = 'vencida')::text AS vencida,
       COUNT(*) FILTER (WHERE canonical_status = 'cancelada')::text AS cancelada,
       COUNT(*) FILTER (WHERE canonical_status = 'erro_emissao')::text AS erro_emissao,
       COALESCE(SUM(amount) FILTER (
         WHERE canonical_status NOT IN ('cancelada', 'rascunho')
       ), 0)::text AS valor_emitido,
       COALESCE(SUM(amount) FILTER (WHERE canonical_status = 'paga'), 0)::text AS valor_recebido,
       COALESCE(SUM(amount) FILTER (WHERE canonical_status = 'vencida'), 0)::text AS valor_vencido
     FROM cobrancas_periodo`,
    [tenantId, period.inicio, period.fim]
  );
  const c = cob.rows[0];
  const total = Number(c?.total ?? 0);
  const paga = Number(c?.paga ?? 0);
  const cancelada = Number(c?.cancelada ?? 0);
  const rascunho = Number(c?.rascunho ?? 0);
  const denominador = total - cancelada - rascunho;
  const taxa = denominador > 0 ? (paga / denominador) * 100 : 0;

  const notif = await client.query<{ channel: string; cnt: string }>(
    `SELECT channel, COUNT(*)::text AS cnt
     FROM communication_events
     WHERE tenant_id = $1
       AND created_at::date BETWEEN $2::date AND $3::date
       AND status IN ('sent', 'failed')
     GROUP BY channel`,
    [tenantId, period.inicio, period.fim]
  );
  let email = 0;
  let whatsapp = 0;
  let falhas = 0;
  let enviadas = 0;
  for (const row of notif.rows) {
    const n = Number(row.cnt);
    if (row.channel === "email") email += n;
    if (row.channel === "whatsapp") whatsapp += n;
  }
  const notifStatus = await client.query<{ status: string; cnt: string }>(
    `SELECT status, COUNT(*)::text AS cnt
     FROM communication_events
     WHERE tenant_id = $1
       AND created_at::date BETWEEN $2::date AND $3::date
     GROUP BY status`,
    [tenantId, period.inicio, period.fim]
  );
  for (const row of notifStatus.rows) {
    const n = Number(row.cnt);
    if (row.status === "sent") enviadas += n;
    if (row.status === "failed") falhas += n;
  }

  const nfse = await client.query<{ status: string; cnt: string }>(
    `SELECT status, COUNT(*)::text AS cnt
     FROM nfse_emissions
     WHERE tenant_id = $1
       AND created_at::date BETWEEN $2::date AND $3::date
     GROUP BY status`,
    [tenantId, period.inicio, period.fim]
  );
  let totalAutorizadas = 0;
  let totalErro = 0;
  for (const row of nfse.rows) {
    const n = Number(row.cnt);
    if (row.status === "autorizado") totalAutorizadas += n;
    if (row.status === "erro") totalErro += n;
  }

  const top = await client.query<{
    nome: string;
    documento: string;
    valor_vencido: string;
    qtd: string;
  }>(
    `SELECT cli.nome, cli.documento,
            COALESCE(SUM(c.amount), 0)::text AS valor_vencido,
            COUNT(*)::text AS qtd
     FROM charges c
     INNER JOIN portal.cliente cli ON cli.id = COALESCE(
       c.customer_id,
       (NULLIF(c.metadata->>'portal_cliente_id', ''))::uuid
     )
     WHERE c.tenant_id = $1::uuid
       AND c.canonical_status = 'vencida'
       AND c.created_at::date BETWEEN $2::date AND $3::date
     GROUP BY cli.nome, cli.documento
     ORDER BY SUM(c.amount) DESC
     LIMIT 5`,
    [tenantId, period.inicio, period.fim]
  );

  return {
    periodo: period,
    cobrancas: {
      total,
      por_status: {
        rascunho: Number(c?.rascunho ?? 0),
        emitida: Number(c?.emitida ?? 0),
        enviada: Number(c?.enviada ?? 0),
        pendente_pagamento: Number(c?.pendente_pagamento ?? 0),
        paga,
        vencida: Number(c?.vencida ?? 0),
        cancelada,
        erro_emissao: Number(c?.erro_emissao ?? 0)
      },
      valor_total_emitido: Number(c?.valor_emitido ?? 0),
      valor_total_recebido: Number(c?.valor_recebido ?? 0),
      valor_total_vencido: Number(c?.valor_vencido ?? 0),
      taxa_conversao: Math.round(taxa * 100) / 100
    },
    notificacoes: {
      total_enviadas: enviadas,
      total_falhas: falhas,
      por_canal: { email, whatsapp }
    },
    nfse: {
      total_autorizadas: totalAutorizadas,
      total_erro: totalErro
    },
    top_clientes_inadimplentes: top.rows.map((row) => ({
      nome: row.nome,
      documento_mascarado: maskDocumento(row.documento),
      valor_vencido: Number(row.valor_vencido),
      qtd_cobr_vencidas: Number(row.qtd)
    }))
  };
}
