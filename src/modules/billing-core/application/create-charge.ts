import { z } from "zod";
import type { PoolClient } from "pg";
import type { AuditRequestContext } from "../../../platform/audit/audit-context";
import { writeAuditLog } from "../../../platform/audit/audit.service";
import { schedulePaymentEmissionJob } from "../../../platform/jobs/enqueue-payment-emission";
import { insertChargeEvent } from "../infrastructure/charge-events-repository";
import { insertCharge } from "../infrastructure/charge-repository";
import type { Charge } from "../domain/charge";

export const createChargeBodySchema = z.object({
  reference: z.string().min(1).max(128),
  idempotency_key: z.string().min(8).max(128),
  amount: z.number().positive(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.enum(["boleto", "pix"]).default("boleto"),
  provider: z.string().max(64).optional(),
  provider_charge_id: z.string().max(128).optional(),
  metadata: z.record(z.unknown()).optional()
});

export type CreateChargeInput = z.infer<typeof createChargeBodySchema>;

function chargeAuditSnapshot(charge: Charge): Record<string, unknown> {
  return {
    reference: charge.reference,
    idempotency_key: charge.idempotencyKey,
    amount: charge.amount,
    due_date: charge.dueDate,
    canonical_status: charge.canonicalStatus
  };
}

export async function createChargeUseCase(
  client: PoolClient,
  raw: unknown,
  audit?: AuditRequestContext
): Promise<{ charge: Charge; inserted: boolean }> {
  const parsed = createChargeBodySchema.safeParse(raw);
  if (!parsed.success) {
    const err = new Error("VALIDATION_ERROR");
    (err as Error & { issues: z.ZodIssue[] }).issues = parsed.error.issues;
    throw err;
  }
  const result = await insertCharge(client, {
    reference: parsed.data.reference,
    idempotencyKey: parsed.data.idempotency_key,
    amount: parsed.data.amount,
    dueDate: parsed.data.due_date,
    type: parsed.data.type,
    provider: parsed.data.provider,
    providerChargeId: parsed.data.provider_charge_id,
    metadata: parsed.data.metadata
  });

  if (result.inserted) {
    await insertChargeEvent(client, {
      tenantId: result.charge.tenantId,
      chargeId: result.charge.id,
      eventType: "charge.created",
      oldStatus: null,
      newStatus: result.charge.canonicalStatus,
      payload: { reference: result.charge.reference, idempotency_key: result.charge.idempotencyKey }
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
    schedulePaymentEmissionJob({
      id: result.charge.id,
      tenantId: result.charge.tenantId
    });
  }

  return result;
}
