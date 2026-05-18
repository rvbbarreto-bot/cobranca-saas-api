import { mapAsaasPaymentFieldStatus } from "../../../modules/payment-gateway/domain/asaas-status-map";
import { AsaasAdapter } from "../../../modules/payment-gateway/infrastructure/asaas/asaas-adapter";
import { insertChargeEvent } from "../../../modules/billing-core/infrastructure/charge-events-repository";
import { evaluateChargeStatusTransition } from "../../../modules/billing-core/application/charge-status-transition";
import type { CanonicalChargeStatus } from "../../../modules/billing-core/domain/charge";
import { decryptAes256Gcm } from "../../crypto/symmetric-encryption";
import { getPool } from "../../persistence/pool";
import { withTenantTransaction } from "../../persistence/with-tenant-transaction";

export type ChargeSyncSummary = {
  scanned: number;
  updated: number;
  errors: number;
};

type StaleChargeRow = {
  charge_id: string;
  tenant_id: string;
  gateway_transaction_id: string;
  canonical_status: string;
  gateway_api_key_encrypted: string;
  encryption_iv: string;
};

async function listStaleCharges(pool: ReturnType<typeof getPool>): Promise<StaleChargeRow[]> {
  const r = await pool.query<StaleChargeRow>(
    `SELECT c.id::text AS charge_id,
            c.tenant_id::text AS tenant_id,
            pt.gateway_transaction_id,
            c.canonical_status,
            ec.gateway_api_key_encrypted,
            ec.encryption_iv
     FROM charges c
     INNER JOIN payment_transactions pt ON pt.charge_id = c.id
     INNER JOIN escritorio_config ec ON ec.tenant_id = c.tenant_id::text
     INNER JOIN tenants t ON t.id = c.tenant_id
     WHERE c.canonical_status IN ('emitida', 'enviada', 'pendente_pagamento')
       AND t.status IN ('active', 'trial')
       AND c.updated_at < now() - interval '24 hours'
       AND pt.gateway_transaction_id IS NOT NULL
     LIMIT 50`
  );
  return r.rows;
}

async function syncOne(row: StaleChargeRow): Promise<boolean> {
  return withTenantTransaction(row.tenant_id, async (client) => {
    const apiKey = decryptAes256Gcm(row.gateway_api_key_encrypted, row.encryption_iv);
    const adapter = new AsaasAdapter({ apiKey });
    const remote = await adapter.getCharge(row.gateway_transaction_id);
    const mapped = mapAsaasPaymentFieldStatus(remote.status);
    if (!mapped) {
      return false;
    }

    const from = row.canonical_status as CanonicalChargeStatus;
    const decision = evaluateChargeStatusTransition(from, mapped);
    if (decision !== "allow") {
      return false;
    }

    await client.query(
      `UPDATE charges
       SET canonical_status = $2,
           paid_at = CASE WHEN $2 = 'paga' THEN now() ELSE paid_at END,
           cancelled_at = CASE WHEN $2 = 'cancelada' THEN now() ELSE cancelled_at END,
           updated_at = now()
       WHERE id = $1::uuid`,
      [row.charge_id, mapped]
    );

    await insertChargeEvent(client, {
      tenantId: row.tenant_id,
      chargeId: row.charge_id,
      eventType: "sync_gateway",
      oldStatus: from,
      newStatus: mapped,
      payload: { gateway_status: remote.status }
    });

    return true;
  });
}

export async function processChargeStatusSync(): Promise<ChargeSyncSummary> {
  const pool = getPool();
  const rows = await listStaleCharges(pool);
  let updated = 0;
  let errors = 0;

  for (const row of rows) {
    try {
      const ok = await syncOne(row);
      if (ok) updated += 1;
    } catch {
      errors += 1;
    }
  }

  // eslint-disable-next-line no-console
  console.log(
    `[charge-status-sync] scanned=${rows.length} updated=${updated} errors=${errors}`
  );

  return { scanned: rows.length, updated, errors };
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
