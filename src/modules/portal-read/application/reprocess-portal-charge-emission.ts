import type { PoolClient } from "pg";
import type { AuditRequestContext } from "../../../platform/audit/audit-context";
import { writeAuditLog } from "../../../platform/audit/audit.service";
import { evaluateChargeStatusTransition } from "../../billing-core/application/charge-status-transition";
import type { Charge } from "../../billing-core/domain/charge";
import { insertChargeEvent } from "../../billing-core/infrastructure/charge-events-repository";
import {
  getChargeById,
  getChargeWithLatestPayment
} from "../../billing-core/infrastructure/charge-repository";
import { schedulePaymentEmissionJob } from "../../../platform/jobs/enqueue-payment-emission";

/**
 * Idade mínima de um `rascunho` para liberar reprocesso manual.
 * Alinhado ao orçamento de timeout do polling no portal-web
 * (CHARGE_EMISSION_TIMEOUT_MS): só permitimos re-enfileirar depois que o
 * worker teve tempo razoável de emitir, evitando corrida com uma emissão
 * recém-agendada que ainda está em andamento.
 */
export const STALE_RASCUNHO_MIN_AGE_MS = 30_000;

export type ReprocessPortalChargeEmissionResult =
  | { ok: true; charge: Charge; jobScheduled: boolean }
  | {
      ok: false;
      kind: "not_found" | "illegal_status";
      status?: Charge["canonicalStatus"];
    };

export async function reprocessPortalChargeEmissionUseCase(
  client: PoolClient,
  chargeId: string,
  audit?: AuditRequestContext
): Promise<ReprocessPortalChargeEmissionResult> {
  const current = await getChargeById(client, chargeId);
  if (!current) {
    return { ok: false, kind: "not_found" };
  }

  if (current.canonicalStatus === "erro_emissao") {
    return reprocessFromError(client, chargeId, current, audit);
  }

  if (current.canonicalStatus === "rascunho") {
    return reprocessStaleRascunho(client, chargeId, current, audit);
  }

  return { ok: false, kind: "illegal_status", status: current.canonicalStatus };
}

/** Caminho clássico: cobrança falhou na emissão e volta para rascunho. */
async function reprocessFromError(
  client: PoolClient,
  chargeId: string,
  current: Charge,
  audit?: AuditRequestContext
): Promise<ReprocessPortalChargeEmissionResult> {
  const decision = evaluateChargeStatusTransition("erro_emissao", "rascunho");
  if (decision !== "allow") {
    return { ok: false, kind: "illegal_status", status: current.canonicalStatus };
  }

  const upd = await client.query(
    `UPDATE charges
     SET canonical_status = 'rascunho', updated_at = now()
     WHERE id = $1::uuid
       AND tenant_id = current_setting('app.tenant_id', true)::uuid
       AND canonical_status = 'erro_emissao'`,
    [chargeId]
  );
  if ((upd.rowCount ?? 0) === 0) {
    return { ok: false, kind: "not_found" };
  }

  await insertChargeEvent(client, {
    tenantId: current.tenantId,
    chargeId,
    eventType: "emission.reprocess",
    oldStatus: "erro_emissao",
    newStatus: "rascunho",
    payload: { portal: true, reason: "manual_reprocess" }
  });

  const charge = await getChargeById(client, chargeId);
  if (!charge) {
    return { ok: false, kind: "not_found" };
  }

  if (audit) {
    await writeAuditLog(
      {
        tenantId: charge.tenantId,
        userId: audit.userId,
        action: "status_change",
        resourceType: "charge",
        resourceId: charge.id,
        oldValue: { canonical_status: "erro_emissao" },
        newValue: { canonical_status: "rascunho" },
        ipAddress: audit.ipAddress,
        userAgent: audit.userAgent
      },
      client
    );
  }

  schedulePaymentEmissionJob({ id: charge.id, tenantId: charge.tenantId });

  return { ok: true, charge, jobScheduled: true };
}

/**
 * Rascunho preso: a emissão assíncrona nunca concluiu (sem payment) e a
 * cobrança já é velha o suficiente. Apenas re-enfileiramos o job — não há
 * transição de status (continua `rascunho`). O dedupe do BullMQ (jobId =
 * chargeId) protege contra disparos simultâneos.
 */
async function reprocessStaleRascunho(
  client: PoolClient,
  chargeId: string,
  current: Charge,
  audit?: AuditRequestContext
): Promise<ReprocessPortalChargeEmissionResult> {
  const withPayment = await getChargeWithLatestPayment(client, chargeId, current.tenantId);
  if (!withPayment) {
    return { ok: false, kind: "not_found" };
  }
  if (withPayment.payment) {
    // Já existe transação de gateway: emissão concluiu, não reprocessa.
    return { ok: false, kind: "illegal_status", status: current.canonicalStatus };
  }

  const ageMs = Date.now() - new Date(current.createdAt).getTime();
  if (Number.isFinite(ageMs) && ageMs < STALE_RASCUNHO_MIN_AGE_MS) {
    // Emissão recém-agendada ainda pode estar em andamento.
    return { ok: false, kind: "illegal_status", status: current.canonicalStatus };
  }

  await insertChargeEvent(client, {
    tenantId: current.tenantId,
    chargeId,
    eventType: "emission.reprocess",
    oldStatus: "rascunho",
    newStatus: "rascunho",
    payload: { portal: true, reason: "manual_reprocess_stale" }
  });

  if (audit) {
    await writeAuditLog(
      {
        tenantId: current.tenantId,
        userId: audit.userId,
        action: "status_change",
        resourceType: "charge",
        resourceId: current.id,
        oldValue: { canonical_status: "rascunho" },
        newValue: { canonical_status: "rascunho" },
        ipAddress: audit.ipAddress,
        userAgent: audit.userAgent
      },
      client
    );
  }

  schedulePaymentEmissionJob({ id: current.id, tenantId: current.tenantId });

  return { ok: true, charge: current, jobScheduled: true };
}
