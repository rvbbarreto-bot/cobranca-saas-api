import { getPool } from "../persistence/pool";
import { isFiscalGuiasEnabled } from "../config/fiscal-guias-enabled";
import type { SliSnapshot } from "./sli-metrics";
import {
  getAllFiscalQueueSnapshots,
  sumFiscalQueueDepthFromSnapshots
} from "../jobs/fiscal-queue-monitor";

function statusFromPercentLowIsBetter(
  value: number | null,
  targetMax: number,
  breachAbove: number
): SliSnapshot["status"] {
  if (value === null) return "unavailable";
  if (value > breachAbove) return "breach";
  if (value > targetMax) return "warning";
  return "ok";
}

function statusFromSecondsLowIsBetter(
  value: number | null,
  targetMax: number,
  breachAbove: number
): SliSnapshot["status"] {
  if (value === null) return "unavailable";
  if (value > breachAbove) return "breach";
  if (value > targetMax) return "warning";
  return "ok";
}

export type FiscalSliResponse = {
  fiscalEnabled: boolean;
  queueDepth: number | null;
  queues: Array<{ name: string; counts: Record<string, number> }>;
  slis: SliSnapshot[];
};

export async function computeFiscalSliSnapshots(): Promise<FiscalSliResponse> {
  if (!isFiscalGuiasEnabled()) {
    return {
      fiscalEnabled: false,
      queueDepth: null,
      queues: [],
      slis: []
    };
  }

  let queueSnapshots: Array<{ name: string; counts: Record<string, number> }> = [];
  let queueDepth: number | null = null;
  try {
    queueSnapshots = await getAllFiscalQueueSnapshots();
    queueDepth = sumFiscalQueueDepthFromSnapshots(queueSnapshots);
  } catch {
    queueDepth = null;
  }

  const pool = getPool();
  const slis: SliSnapshot[] = [];

  slis.push({
    id: "fiscal_queue_depth",
    name: "Profundidade filas fiscais (waiting+delayed+active)",
    value: queueDepth,
    unit: "ratio",
    sloTarget: 50,
    window: "instantaneo",
    status:
      queueDepth === null
        ? "unavailable"
        : queueDepth > 100
          ? "breach"
          : queueDepth > 50
            ? "warning"
            : "ok",
    owner: "operacoes",
    detail: "Soma BullMQ fiscal-capture, ingest, serpro-transmit/recibo/emit-das, certificate-expiry"
  });

  const transmitR = await pool.query<{ p95_seconds: string | null }>(`
    SELECT percentile_cont(0.95) WITHIN GROUP (
      ORDER BY EXTRACT(EPOCH FROM (fim.created_at - inicio.created_at))
    ) AS p95_seconds
    FROM fiscal.processamento_evento inicio
    INNER JOIN fiscal.processamento_evento fim
      ON fim.processamento_id = inicio.processamento_id
     AND fim.evento = 'transmissao_concluida'
    WHERE inicio.evento = 'transmissao_iniciada'
      AND inicio.created_at >= NOW() - INTERVAL '7 days'
  `);
  const transmitP95 =
    transmitR.rows[0]?.p95_seconds != null ? Number(transmitR.rows[0].p95_seconds) : null;
  slis.push({
    id: "fiscal_transmit_latency_p95",
    name: "Latência transmissão SERPRO (p95)",
    value: transmitP95,
    unit: "seconds",
    sloTarget: 120,
    window: "7d rolling",
    status: statusFromSecondsLowIsBetter(transmitP95, 120, 300),
    owner: "engenharia",
    detail: "transmissao_iniciada → transmissao_concluida em processamento_evento"
  });

  const serproErrR = await pool.query<{ error_rate_pct: string | null; total: string }>(`
    SELECT
      COUNT(*) FILTER (
        WHERE status = 'ERRO'
          AND (
            erro_codigo LIKE 'SERPRO%'
            OR erro_codigo LIKE '%SERPRO%'
            OR erro_codigo IN ('RECIBO_SERPRO_ERRO', 'DAS_SERPRO_ERRO')
          )
      ) * 100.0 / NULLIF(COUNT(*), 0) AS error_rate_pct,
      COUNT(*)::text AS total
    FROM fiscal.processamento_fiscal
    WHERE updated_at >= NOW() - INTERVAL '7 days'
      AND status IN ('CONCLUIDO', 'ERRO', 'TRANSMITIDA', 'RECIBO_OK', 'EMITINDO_DAS')
  `);
  const serproErrorRate =
    serproErrR.rows[0]?.error_rate_pct != null ? Number(serproErrR.rows[0].error_rate_pct) : null;
  const serproTotal = Number(serproErrR.rows[0]?.total ?? 0);
  slis.push({
    id: "fiscal_serpro_error_rate",
    name: "Taxa erro SERPRO (processamentos)",
    value: serproErrorRate,
    unit: "percent",
    sloTarget: 5,
    window: "7d rolling",
    status: statusFromPercentLowIsBetter(serproErrorRate, 5, 10),
    owner: "engenharia",
    detail: serproTotal === 0 ? "Sem processamentos no periodo" : `${serproTotal} processamentos no periodo`
  });

  return {
    fiscalEnabled: true,
    queueDepth,
    queues: queueSnapshots,
    slis
  };
}
