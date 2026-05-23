import type { PoolClient } from "pg";
import { z } from "zod";
import type { AuditRequestContext } from "../../../platform/audit/audit-context";
import { writeAuditLog } from "../../../platform/audit/audit.service";
import { createChargeBodySchema } from "../../billing-core/application/create-charge";
import type { Charge } from "../../billing-core/domain/charge";
import { insertChargeEvent } from "../../billing-core/infrastructure/charge-events-repository";
import { insertCharge } from "../../billing-core/infrastructure/charge-repository";
import { schedulePaymentEmissionJob } from "../../../platform/jobs/enqueue-payment-emission";
import {
  assertTenantCanMutate,
  recordChargeCreatedForMetering
} from "../../saas-billing/application/assert-tenant-can-mutate";
import { SaasBillingError } from "../../saas-billing/domain/saas-billing-error";
import { assertPortalChargeCreateAllowed } from "./validate-portal-charge-create";

const portalChargeCreateSchema = createChargeBodySchema.extend({
  portal_cliente_id: z.string().uuid().optional()
});

function chargeAuditSnapshot(charge: Charge): Record<string, unknown> {
  return {
    reference: charge.reference,
    idempotency_key: charge.idempotencyKey,
    amount: charge.amount,
    due_date: charge.dueDate,
    canonical_status: charge.canonicalStatus,
    portal_cliente_id: charge.metadata.portal_cliente_id ?? null
  };
}

export async function createPortalChargeUseCase(
  client: PoolClient,
  automacaoTenantId: string,
  publicTenantId: string,
  raw: unknown,
  audit?: AuditRequestContext
): Promise<{ charge: Charge; inserted: boolean }> {
  const parsed = portalChargeCreateSchema.safeParse(raw);
  if (!parsed.success) {
    const err = new Error("VALIDATION_ERROR");
    (err as Error & { issues: unknown }).issues = parsed.error.issues;
    throw err;
  }

  const data = parsed.data;

  const { reference: sanitizedReference } = await assertPortalChargeCreateAllowed(client, automacaoTenantId, {
    reference: data.reference,
    amount: data.amount,
    due_date: data.due_date,
    portal_cliente_id: data.portal_cliente_id
  });

  if (data.portal_cliente_id) {
    const chk = await client.query(
      `SELECT 1 FROM portal.cliente WHERE id = $1::uuid AND tenant_id = $2 LIMIT 1`,
      [data.portal_cliente_id, automacaoTenantId]
    );
    if (chk.rowCount === 0) {
      throw new Error("PORTAL_CLIENTE_NOT_FOUND");
    }
  }

  try {
    await assertTenantCanMutate(client, publicTenantId, "create_charge");
  } catch (e) {
    if (e instanceof SaasBillingError) {
      throw e;
    }
    throw e;
  }

  const metadata: Record<string, unknown> = { ...(data.metadata ?? {}) };
  if (data.portal_cliente_id) {
    metadata.portal_cliente_id = data.portal_cliente_id;
    metadata.portal_automacao_tenant_id = automacaoTenantId;
  }

  const result = await insertCharge(client, {
    reference: sanitizedReference,
    idempotencyKey: data.idempotency_key,
    amount: data.amount,
    dueDate: data.due_date,
    type: data.type,
    provider: data.provider,
    providerChargeId: data.provider_charge_id,
    metadata
  });

  if (result.inserted) {
    await insertChargeEvent(client, {
      tenantId: result.charge.tenantId,
      chargeId: result.charge.id,
      eventType: "charge.created",
      oldStatus: null,
      newStatus: result.charge.canonicalStatus,
      payload: { reference: result.charge.reference, portal: true }
    });
  }

  if (result.inserted && audit) {
    await writeAuditLog(
      {
        tenantId: result.charge.tenantId,
        userId: audit.userId,
        action: "create",
        resourceType: "charge",
        resourceId: result.charge.id,
        newValue: chargeAuditSnapshot(result.charge),
        ipAddress: audit.ipAddress,
        userAgent: audit.userAgent
      },
      client
    );
  }

  if (result.inserted) {
    await recordChargeCreatedForMetering(client, publicTenantId);
    schedulePaymentEmissionJob({
      id: result.charge.id,
      tenantId: result.charge.tenantId
    });
  }

  return result;
}
