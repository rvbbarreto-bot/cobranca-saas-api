import { getPool } from "../../persistence/pool";
import { processChargeSyncReconciliation } from "./charge-sync-reconciliation";

export type ChargeSyncSummary = {
  scanned: number;
  updated: number;
  errors: number;
};

/** Failsafe: reconcilia cobranças sem webhook há 24h consultando o gateway. */
export async function processChargeStatusSync(): Promise<ChargeSyncSummary> {
  const result = await processChargeSyncReconciliation();
  return {
    scanned: result.processed,
    updated: result.updated,
    errors: result.errors
  };
}

/** Regua diaria: enfileira notificacoes conforme charging_rules. */
export async function processDailyChargingRegua(
  enqueue: (payload: {
    chargeId: string;
    tenantId: string;
    eventType: string;
    daysOffset: number;
  }) => Promise<void>
): Promise<{ tenants: number; jobs: number }> {
  const pool = getPool();
  const tenantsR = await pool.query<{ tenant_id: string }>(
    `SELECT DISTINCT cr.tenant_id
     FROM charging_rules cr
     INNER JOIN tenants t ON t.id::text = cr.tenant_id
     WHERE cr.is_active = true AND t.status IN ('active', 'trial')`
  );

  let jobs = 0;
  for (const { tenant_id: tenantId } of tenantsR.rows) {
    const rulesR = await pool.query<{ days_offset: number; channel: string }>(
      `SELECT days_offset, channel FROM charging_rules
       WHERE tenant_id = $1 AND is_active = true`,
      [tenantId]
    );

    for (const rule of rulesR.rows) {
      const targetDue = await pool.query<{ id: string }>(
        `SELECT c.id::text AS id
         FROM charges c
         WHERE c.tenant_id = $1::uuid
           AND c.due_date = (CURRENT_DATE - ($2::int * interval '1 day'))::date
           AND c.canonical_status IN ('enviada', 'pendente_pagamento', 'vencida')
           AND NOT EXISTS (
             SELECT 1 FROM communication_events ce
             WHERE ce.charge_id = c.id
               AND ce.event_type = $3
               AND ce.created_at::date = CURRENT_DATE
           )`,
        [tenantId, rule.days_offset, mapOffsetEvent(rule.days_offset)]
      );

      for (const ch of targetDue.rows) {
        await enqueue({
          chargeId: ch.id,
          tenantId,
          eventType: mapOffsetEvent(rule.days_offset),
          daysOffset: rule.days_offset
        });
        jobs += 1;
      }
    }
  }

  return { tenants: tenantsR.rows.length, jobs };
}

function mapOffsetEvent(daysOffset: number): string {
  if (daysOffset === -3) return "lembrete_pre_3d";
  if (daysOffset === -1) return "lembrete_pre_1d";
  if (daysOffset === 0) return "vencimento_hoje";
  if (daysOffset === 3) return "pos_vencimento_3d";
  if (daysOffset === 7) return "pos_vencimento_7d";
  return `regua_${daysOffset}`;
}
