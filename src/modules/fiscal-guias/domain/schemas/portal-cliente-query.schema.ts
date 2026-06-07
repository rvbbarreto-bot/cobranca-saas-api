import { z } from "zod";

export const portalClienteIdQuerySchema = z.object({
  portal_cliente_id: z.string().uuid()
});

export type PortalClienteIdQuery = z.infer<typeof portalClienteIdQuerySchema>;

export function parsePortalClienteIdQuery(
  query: unknown
): { ok: true; value: PortalClienteIdQuery } | { ok: false; issues: z.ZodIssue[] } {
  const parsed = portalClienteIdQuerySchema.safeParse(query);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues };
  }
  return { ok: true, value: parsed.data };
}
