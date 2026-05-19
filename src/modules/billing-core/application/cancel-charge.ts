import type { PoolClient } from "pg";
import type { AuditRequestContext } from "../../../platform/audit/audit-context";
import { writeAuditLog } from "../../../platform/audit/audit.service";
import type { Charge } from "../domain/charge";
import { getChargeById } from "../infrastructure/charge-repository";
import { evaluateChargeStatusTransition } from "./charge-status-transition";

export type CancelChargeResult =
  | { ok: true; charge: Charge }
  | {
      ok: false;
      kind: "not_found" | "illegal_transition";
      from?: Charge["canonicalStatus"];
      to?: "cancelada";
    };

export async function cancelChargeUseCase(
  client: PoolClient,
  chargeId: string,
  audit?: AuditRequestContext
): Promise<CancelChargeResult> {
  const current = await getChargeById(client, chargeId);
  if (!current) {
    return { ok: false, kind: "not_found" };
  }

  const decision = evaluateChargeStatusTransition(current.canonicalStatus, "cancelada");
  if (decision === "deny") {
    return {
      ok: false,
      kind: "illegal_transition",
      from: current.canonicalStatus,
      to: "cancelada"
    };
  }
  if (decision === "noop") {
    return { ok: true, charge: current };
  }

  const upd = await client.query(
    `UPDATE charges
     SET canonical_status = 'cancelada', updated_at = now()
     WHERE id = $1::uuid
       AND tenant_id = current_setting('app.tenant_id', true)::uuid`,
    [chargeId]
  );
  if ((upd.rowCount ?? 0) === 0) {
    return { ok: false, kind: "not_found" };
  }

  const charge = await getChargeById(client, chargeId);
  if (!charge) {
    return { ok: false, kind: "not_found" };
  }

  if (audit) {
    await writeAuditLog(
      {
        tenantId: charge.tenantId,
        userId: audit.userId,
        action: "cancel",
        resourceType: "charge",
        resourceId: charge.id,
        oldValue: { canonical_status: current.canonicalStatus },
        newValue: { canonical_status: charge.canonicalStatus },
        ipAddress: audit.ipAddress,
        userAgent: audit.userAgent
      },
      client
    );
  }

  return { ok: true, charge };
}
