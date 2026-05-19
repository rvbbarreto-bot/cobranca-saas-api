import { z } from "zod";
import type { PoolClient } from "pg";
import { renderTemplate } from "../../notifications/application/render-template";
import { getChargeWithLatestPayment } from "../../billing-core/infrastructure/charge-repository";

const patchTemplateSchema = z.object({
  subject: z.string().max(200).optional(),
  body_template: z.string().min(10).max(1024)
});

export async function listNotificationTemplates(client: PoolClient, tenantId: string) {
  const r = await client.query(
    `SELECT id::text, tenant_id, event_type, channel, subject, body_template, is_active, updated_at
     FROM notification_templates
     WHERE tenant_id = $1 OR tenant_id IS NULL
     ORDER BY tenant_id NULLS FIRST, event_type`,
    [tenantId]
  );
  return r.rows;
}

export async function patchNotificationTemplate(
  client: PoolClient,
  tenantId: string,
  templateId: string,
  raw: unknown
) {
  const parsed = patchTemplateSchema.safeParse(raw);
  if (!parsed.success) {
    const err = new Error("VALIDATION_ERROR");
    (err as Error & { issues: unknown }).issues = parsed.error.issues;
    throw err;
  }

  const cur = await client.query<{ tenant_id: string | null }>(
    `SELECT tenant_id FROM notification_templates WHERE id = $1::uuid`,
    [templateId]
  );
  const row = cur.rows[0];
  if (!row) {
    throw new Error("NOT_FOUND");
  }
  if (row.tenant_id === null) {
    throw new Error("SYSTEM_TEMPLATE_READONLY");
  }
  if (row.tenant_id !== tenantId) {
    throw new Error("FORBIDDEN");
  }

  const r = await client.query(
    `UPDATE notification_templates
     SET subject = COALESCE($3, subject),
         body_template = $4,
         updated_at = now()
     WHERE id = $1::uuid AND tenant_id = $2
     RETURNING id::text, event_type, channel, subject, body_template`,
    [templateId, tenantId, parsed.data.subject ?? null, parsed.data.body_template]
  );
  return r.rows[0];
}

export async function previewNotificationTemplate(
  client: PoolClient,
  tenantId: string,
  templateId: string,
  chargeId: string
) {
  const tplR = await client.query<{ subject: string | null; body_template: string }>(
    `SELECT subject, body_template FROM notification_templates WHERE id = $1::uuid
       AND (tenant_id = $2 OR tenant_id IS NULL)`,
    [templateId, tenantId]
  );
  const tpl = tplR.rows[0];
  if (!tpl) {
    throw new Error("NOT_FOUND");
  }

  const detail = await getChargeWithLatestPayment(client, chargeId, tenantId);
  if (!detail) {
    throw new Error("CHARGE_NOT_FOUND");
  }

  const vars: Record<string, string> = {
    nome: String(detail.charge.metadata.nome ?? "Cliente"),
    valor: detail.charge.amount,
    data_vencimento: detail.charge.dueDate,
    link_boleto: detail.payment?.boleto_url ?? "",
    link_pix: detail.payment?.pix_link ?? "",
    pix_emv: detail.payment?.pix_emv ?? "",
    escritorio_nome: "Escritorio",
    multa_percentual: "2",
    data_pagamento: new Date().toISOString().slice(0, 10)
  };

  return {
    subject: tpl.subject ? renderTemplate(tpl.subject, vars) : null,
    body_rendered: renderTemplate(tpl.body_template, vars)
  };
}
