import type { PoolClient } from "pg";
import type { AuditRequestContext } from "../../../platform/audit/audit-context";
import { writeAuditLog } from "../../../platform/audit/audit.service";
import { evaluateChargeStatusTransition } from "../../billing-core/application/charge-status-transition";
import type { Charge } from "../../billing-core/domain/charge";
import { insertChargeEvent } from "../../billing-core/infrastructure/charge-events-repository";
import { getChargeById } from "../../billing-core/infrastructure/charge-repository";
import { schedulePaymentEmissionJob } from "../../../platform/jobs/enqueue-payment-emission";

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

  if (current.canonicalStatus !== "erro_emissao") {
    return { ok: false, kind: "illegal_status", status: current.canonicalStatus };
  }

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
