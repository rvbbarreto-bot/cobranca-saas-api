import type { PoolClient } from "pg";
import { z } from "zod";
import type { Charge } from "../../billing-core/domain/charge";
import { patchChargeEditableFields } from "../../billing-core/infrastructure/charge-repository";

export const patchPortalChargeBodySchema = z
  .object({
    amount: z.number().positive().optional(),
    due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    metadata: z.record(z.unknown()).optional()
  })
  .refine((d) => d.amount !== undefined || d.due_date !== undefined || d.metadata !== undefined, {
    message: "Informe ao menos um campo: amount, due_date ou metadata.",
    path: ["body"]
  });

export type PatchPortalChargeBody = z.infer<typeof patchPortalChargeBodySchema>;

export function parsePatchPortalChargeBody(raw: unknown):
  | { ok: true; value: PatchPortalChargeBody }
  | { ok: false; issues: z.ZodIssue[] } {
  const parsed = patchPortalChargeBodySchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues };
  }
  return { ok: true, value: parsed.data };
}

export async function patchPortalChargeUseCase(
  client: PoolClient,
  chargeId: string,
  raw: unknown
): Promise<
  | { ok: true; charge: Charge }
  | { ok: false; kind: "validation"; issues: z.ZodIssue[] }
  | { ok: false; kind: "not_found" }
  | { ok: false; kind: "not_editable" }
> {
  const parsed = parsePatchPortalChargeBody(raw);
  if (!parsed.ok) {
    return { ok: false, kind: "validation", issues: parsed.issues };
  }

  const result = await patchChargeEditableFields(client, chargeId, {
    amount: parsed.value.amount,
    dueDate: parsed.value.due_date,
    metadata: parsed.value.metadata
  });

  if (!result.ok) {
    if (result.reason === "not_found") {
      return { ok: false, kind: "not_found" };
    }
    return { ok: false, kind: "not_editable" };
  }
  return { ok: true, charge: result.charge };
}
