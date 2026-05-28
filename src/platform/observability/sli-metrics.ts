import { getPool } from "../persistence/pool";

export type SliSnapshot = {
  id: string;
  name: string;
  value: number | null;
  unit: "percent" | "seconds" | "ratio";
  sloTarget: number;
  window: string;
  status: "ok" | "warning" | "breach" | "unavailable";
  owner: string;
  detail?: string;
};

function statusFromPercent(value: number | null, target: number, warnBelow: number): SliSnapshot["status"] {
  if (value === null) {
    return "unavailable";
  }
  if (value < warnBelow) {
    return "breach";
  }
  if (value < target) {
    return "warning";
  }
  return "ok";
}

export async function computeSliSnapshots(): Promise<SliSnapshot[]> {
  const pool = getPool();
  const snapshots: SliSnapshot[] = [];

  const emissionR = await pool.query<{ sli_pct: string | null }>(`
    SELECT
      COUNT(*) FILTER (WHERE emitted_within_sla) * 100.0 / NULLIF(COUNT(*), 0) AS sli_pct
    FROM (
      SELECT c.id,
        EXISTS (
          SELECT 1 FROM charge_events e
          WHERE e.charge_id = c.id
            AND e.event_type = 'charge.emitted'
            AND e.created_at <= c.created_at + INTERVAL '5 minutes'
        ) AS emitted_within_sla
      FROM charges c
      WHERE c.created_at >= NOW() - INTERVAL '7 days'
    ) t
  `);
  const emissionPct = emissionR.rows[0]?.sli_pct != null ? Number(emissionR.rows[0].sli_pct) : null;
  snapshots.push({
    id: "boleto_emission_rate",
    name: "Taxa de emissão de boleto",
    value: emissionPct,
    unit: "percent",
    sloTarget: 99.5,
    window: "7d rolling",
    status: statusFromPercent(emissionPct, 99.5, 99),
    owner: "engenharia"
  });

  const webhookR = await pool.query<{ p95_seconds: string | null }>(`
    SELECT percentile_cont(0.95) WITHIN GROUP (
      ORDER BY EXTRACT(EPOCH FROM (processed_at - created_at))
    ) AS p95_seconds
    FROM webhook_inbox
    WHERE processed_at IS NOT NULL
      AND created_at >= NOW() - INTERVAL '24 hours'
  `);
  const p95 = webhookR.rows[0]?.p95_seconds != null ? Number(webhookR.rows[0].p95_seconds) : null;
  snapshots.push({
    id: "webhook_latency_p95",
    name: "Latência de webhook (p95)",
    value: p95,
    unit: "seconds",
    sloTarget: 30,
    window: "24h rolling",
    status:
      p95 === null ? "unavailable" : p95 > 60 ? "breach" : p95 > 30 ? "warning" : "ok",
    owner: "engenharia"
  });

  const erroR = await pool.query<{ error_rate_pct: string | null }>(`
    SELECT
      COUNT(*) FILTER (WHERE canonical_status = 'erro_emissao') * 100.0
        / NULLIF(COUNT(*), 0) AS error_rate_pct
    FROM charges
    WHERE created_at >= NOW() - INTERVAL '7 days'
  `);
  const errorRate = erroR.rows[0]?.error_rate_pct != null ? Number(erroR.rows[0].error_rate_pct) : null;
  snapshots.push({
    id: "emission_error_rate",
    name: "Taxa erro emissão",
    value: errorRate,
    unit: "percent",
    sloTarget: 2,
    window: "7d rolling",
    status:
      errorRate === null ? "unavailable" : errorRate > 5 ? "breach" : errorRate > 2 ? "warning" : "ok",
    owner: "produto+engenharia"
  });

  const dupR = await pool.query<{ duplicate_violations: string }>(`
    SELECT COUNT(*)::text AS duplicate_violations
    FROM (
      SELECT tenant_id, external_event_id, COUNT(*) AS c
      FROM webhook_inbox
      WHERE external_event_id IS NOT NULL
        AND created_at >= NOW() - INTERVAL '7 days'
      GROUP BY tenant_id, external_event_id
      HAVING COUNT(*) > 1
    ) d
  `);
  const dupCount = Number(dupR.rows[0]?.duplicate_violations ?? 0);
  const idempotencyPct = dupCount === 0 ? 100 : 0;
  snapshots.push({
    id: "webhook_idempotency",
    name: "Idempotência webhook",
    value: idempotencyPct,
    unit: "percent",
    sloTarget: 100,
    window: "7d rolling",
    status: dupCount > 0 ? "breach" : "ok",
    owner: "engenharia",
    detail: dupCount > 0 ? `${dupCount} chaves duplicadas` : undefined
  });

  snapshots.push({
    id: "portal_api_availability",
    name: "Disponibilidade API portal",
    value: null,
    unit: "percent",
    sloTarget: 99.9,
    window: "30d rolling",
    status: "unavailable",
    owner: "sre",
    detail: "Requer agregação de logs http_access (Loki/Datadog). Ver docs/observability/sli-definitions.md"
  });

  const notifR = await pool.query<{ delivery_pct: string | null }>(`
    SELECT
      COUNT(*) FILTER (WHERE status IN ('sent', 'delivered')) * 100.0
        / NULLIF(COUNT(*), 0) AS delivery_pct
    FROM communication_events
    WHERE created_at >= NOW() - INTERVAL '7 days'
  `);
  const deliveryPct = notifR.rows[0]?.delivery_pct != null ? Number(notifR.rows[0].delivery_pct) : null;
  snapshots.push({
    id: "notification_delivery_rate",
    name: "Taxa notificação entregue",
    value: deliveryPct,
    unit: "percent",
    sloTarget: 98,
    window: "7d rolling",
    status: statusFromPercent(deliveryPct, 98, 95),
    owner: "operacoes"
  });

  const paidR = await pool.query<{ confirm_pct: string | null }>(`
    SELECT
      COUNT(*) FILTER (WHERE confirmed_within_sla) * 100.0 / NULLIF(COUNT(*), 0) AS confirm_pct
    FROM (
      SELECT c.id,
        EXISTS (
          SELECT 1 FROM charge_events e
          WHERE e.charge_id = c.id
            AND e.event_type IN ('payment.confirmed', 'charge.paid')
            AND e.created_at <= c.updated_at + INTERVAL '2 minutes'
        ) AS confirmed_within_sla
      FROM charges c
      WHERE c.canonical_status = 'paga'
        AND c.updated_at >= NOW() - INTERVAL '7 days'
    ) t
  `);
  const confirmPct = paidR.rows[0]?.confirm_pct != null ? Number(paidR.rows[0].confirm_pct) : null;
  snapshots.push({
    id: "payment_confirmed_latency",
    name: "Cobrança paga confirmada < 2min",
    value: confirmPct,
    unit: "percent",
    sloTarget: 99,
    window: "7d rolling",
    status: statusFromPercent(confirmPct, 99, 97),
    owner: "operacoes"
  });

  return snapshots;
}
