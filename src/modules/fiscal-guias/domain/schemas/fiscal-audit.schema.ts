import { z } from "zod";
import type { FiscalAuditAction } from "../../infrastructure/fiscal-audit.service";

export const FISCAL_AUDIT_ACTIONS = [
  "download_pdf",
  "consulta_guia",
  "status_change",
  "upload_certificado",
  "admin_access",
  "guia_disponibilizada",
  "compliance_bloqueio",
  "capture_requested",
  "capture_failed",
  "certificado_expirando",
  "procuracao_validada_serpro"
] as const satisfies readonly FiscalAuditAction[];

export const listFiscalAuditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  action: z.enum(FISCAL_AUDIT_ACTIONS).optional(),
  user_id: z.string().trim().min(1).max(128).optional()
});

export type ListFiscalAuditQuery = z.infer<typeof listFiscalAuditQuerySchema>;

export type FiscalAuditLogResponse = {
  id: string;
  user_id: string | null;
  action: FiscalAuditAction;
  resource_type: string;
  resource_id: string;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
};
