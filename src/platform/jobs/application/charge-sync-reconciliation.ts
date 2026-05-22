import type { Pool, PoolClient } from "pg";
import { mapGatewayChargeStatus } from "../../../modules/payment-gateway/domain/gateway-status-map";
import type { PaymentGatewayAdapter } from "../../../modules/payment-gateway/domain/payment-gateway.interface";
import { getGatewayForTenant } from "../../../modules/payment-gateway/application/get-gateway-for-tenant";
import { isProductionNodeEnv } from "../../config/runtime-flags";
import { evaluateChargeStatusTransition } from "../../../modules/billing-core/application/charge-status-transition";
import type { CanonicalChargeStatus } from "../../../modules/billing-core/domain/charge";
import { insertChargeEvent } from "../../../modules/billing-core/infrastructure/charge-events-repository";
import { writeAuditLog } from "../../audit/audit.service";
import { decrypt } from "../../crypto/decrypt";
import { getPool } from "../../persistence/pool";
import { withTenantTransaction } from "../../persistence/with-tenant-transaction";

/** Ordem de progressão principal (sync só avança, nunca retrocede nesta cadeia). */
const MAIN_PROGRESSION: readonly CanonicalChargeStatus[] = [
  "rascunho",
  "emitida",
  "enviada",
  "pendente_pagamento",
  "paga"
];

export type ChargeSyncCandidateRow = {
  charge_id: string;
  tenant_id: string;
  canonical_status: string;
  gateway_transaction_id: string;
  gateway_api_key_encrypted: string;
  gateway_api_key_iv: string;
  gateway_provider: string | null;
};

export type ChargeSyncReconciliationSummary = {
  processed: number;
  updated: number;
  errors: number;
};

export type ChargeSyncReconciliationDeps = {
  pool?: Pool;
  withTenant?: typeof withTenantTransaction;
  createAdapter?: (apiKey: string) => PaymentGatewayAdapter;
  getGateway?: (
    client: PoolClient,
    tenantId: string
  ) => Promise<PaymentGatewayAdapter>;
  decryptApiKey?: (ciphertext: string, iv: string) => string;
  logWarn?: (message: string) => void;
};

/**
 * Sync de reconciliação: só avança status; ignora noop e retrocesso na cadeia principal.
 */
export function canSyncReconciliationTransition(
  from: CanonicalChargeStatus,
  to: CanonicalChargeStatus
): "noop" | "allow" | "deny" {
  if (from === to) {
    return "noop";
  }
  if (from === "paga" || from === "cancelada") {
    return "deny";
  }
  if (evaluateChargeStatusTransition(from, to) !== "allow") {
    return "deny";
  }

  const fromIdx = MAIN_PROGRESSION.indexOf(from);
  const toIdx = MAIN_PROGRESSION.indexOf(to);
  if (fromIdx >= 0 && toIdx >= 0 && toIdx <= fromIdx) {
    return "deny";
  }

  return "allow";
}

export async function listChargeSyncCandidates(
  pool: Pool
): Promise<ChargeSyncCandidateRow[]> {
  const r = await pool.query<ChargeSyncCandidateRow>(
    `SELECT
       c.id::text AS charge_id,
       c.tenant_id::text AS tenant_id,
       c.canonical_status,
       pt.gateway_transaction_id,
       ec.gateway_api_key_encrypted,
       ec.encryption_iv AS gateway_api_key_iv,
       ec.gateway_provider
     FROM charges c
     INNER JOIN payment_transactions pt ON pt.charge_id = c.id
     INNER JOIN escritorio_config ec ON ec.tenant_id = c.tenant_id::text
     WHERE c.canonical_status IN ('emitida', 'enviada', 'pendente_pagamento')
       AND c.updated_at < now() - interval '24 hours'
       AND pt.gateway_transaction_id IS NOT NULL
       AND (ec.gateway_api_key_encrypted IS NOT NULL OR ec.gateway_credentials_encrypted IS NOT NULL)
     ORDER BY c.updated_at ASC
     LIMIT 50`
  );
  return r.rows;
}

export async function reconcileOneCharge(
  row: ChargeSyncCandidateRow,
  deps: ChargeSyncReconciliationDeps = {}
): Promise<"updated" | "skipped" | "error"> {
  const withTenant = deps.withTenant ?? withTenantTransaction;
  const logWarn = deps.logWarn ?? (() => undefined);
  const provider = String(row.gateway_provider || "asaas").trim().toLowerCase();

  try {
    const from = row.canonical_status as CanonicalChargeStatus;
    let adapter: PaymentGatewayAdapter;
    if (deps.getGateway) {
      adapter = await withTenant(row.tenant_id, (client) =>
        deps.getGateway!(client, row.tenant_id)
      );
    } else if (deps.createAdapter) {
      const decryptApiKey = deps.decryptApiKey ?? decrypt;
      const apiKey = decryptApiKey(row.gateway_api_key_encrypted, row.gateway_api_key_iv);
      adapter = deps.createAdapter(apiKey);
    } else {
      adapter = await withTenant(row.tenant_id, (client) =>
        getGatewayForTenant(client, row.tenant_id, {
          decrypt: deps.decryptApiKey ?? decrypt,
          sandbox: !isProductionNodeEnv()
        })
      );
    }
    const gatewayCharge = await adapter.getCharge(row.gateway_transaction_id);
    const newCanonical = mapGatewayChargeStatus(provider, gatewayCharge.status);

    if (!newCanonical) {
      return "skipped";
    }

    const decision = canSyncReconciliationTransition(from, newCanonical);
    if (decision === "noop") {
      return "skipped";
    }
    if (decision === "deny") {
      logWarn(
        `charge-status-sync: transicao ignorada charge=${row.charge_id} ${from}->${newCanonical}`
      );
      return "skipped";
    }

    await withTenant(row.tenant_id, async (client) => {
      await applySyncUpdate(client, row, from, newCanonical, gatewayCharge.status);
    });

    return "updated";
  } catch {
    return "error";
  }
}

async function applySyncUpdate(
  client: PoolClient,
  row: ChargeSyncCandidateRow,
  from: CanonicalChargeStatus,
  to: CanonicalChargeStatus,
  gatewayStatus: string
): Promise<void> {
  const upd = await client.query(
    `UPDATE charges
     SET canonical_status = $2::text,
         paid_at = CASE WHEN $2::text = 'paga' THEN now() ELSE paid_at END,
         cancelled_at = CASE WHEN $2::text = 'cancelada' THEN now() ELSE cancelled_at END,
         updated_at = now()
     WHERE id = $1::uuid
       AND tenant_id = $3::uuid`,
    [row.charge_id, to, row.tenant_id]
  );

  if ((upd.rowCount ?? 0) === 0) {
    return;
  }

  await insertChargeEvent(client, {
    tenantId: row.tenant_id,
    chargeId: row.charge_id,
    eventType: "sync_reconciliation",
    oldStatus: from,
    newStatus: to,
    payload: { source: "charge-status-sync", gateway_status: gatewayStatus }
  });

  await writeAuditLog(
    {
      tenantId: row.tenant_id,
      action: "status_change",
      resourceType: "charge",
      resourceId: row.charge_id,
      oldValue: { canonical_status: from },
      newValue: { canonical_status: to }
    },
    client
  );
}

export async function processChargeSyncReconciliation(
  deps: ChargeSyncReconciliationDeps = {}
): Promise<ChargeSyncReconciliationSummary> {
  const pool = deps.pool ?? getPool();
  const rows = await listChargeSyncCandidates(pool);
  let updated = 0;
  let errors = 0;

  for (const row of rows) {
    const outcome = await reconcileOneCharge(row, deps);
    if (outcome === "updated") {
      updated += 1;
    } else if (outcome === "error") {
      errors += 1;
    }
  }

  const summary = {
    processed: rows.length,
    updated,
    errors
  };

  // eslint-disable-next-line no-console
  console.info(
    `charge-status-sync: processadas=${summary.processed} atualizadas=${summary.updated} erros=${summary.errors}`
  );

  return summary;
}
