import type { PoolClient } from "pg";
import type { NotificationAdapter } from "../../../modules/notifications/domain/notification.interface";
import { renderTemplate } from "../../../modules/notifications/application/render-template";
import { createDefaultNotificationAdapter } from "../../../modules/notifications/infrastructure/composite-notification-adapter";
import { withTenantTransaction } from "../../persistence/with-tenant-transaction";
import type { NotificationSendJobPayload } from "../enqueue-notification";

function formatBrl(amount: string): string {
  const n = Number(amount);
  if (Number.isNaN(n)) return amount;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDateBr(isoDate: string): string {
  const [y, m, d] = isoDate.slice(0, 10).split("-");
  if (!y || !m || !d) return isoDate;
  return `${d}/${m}/${y}`;
}

type TemplateRow = {
  channel: "email" | "whatsapp";
  subject: string | null;
  body_template: string;
};

async function loadTemplate(
  client: PoolClient,
  tenantId: string,
  eventType: string,
  channel: "email" | "whatsapp"
): Promise<TemplateRow | null> {
  const r = await client.query<TemplateRow>(
    `SELECT channel, subject, body_template
     FROM notification_templates
     WHERE event_type = $2 AND channel = $3 AND is_active = true
       AND (tenant_id = $1 OR tenant_id IS NULL)
     ORDER BY tenant_id NULLS LAST
     LIMIT 1`,
    [tenantId, eventType, channel]
  );
  return r.rows[0] ?? null;
}

async function insertCommunicationEvent(
  client: PoolClient,
  input: {
    tenantId: string;
    chargeId: string;
    channel: string;
    eventType: string;
    recipient: string;
    status: "sent" | "failed";
    providerMessageId?: string;
    errorMessage?: string;
  }
): Promise<void> {
  await client.query(
    `INSERT INTO communication_events (
       tenant_id, charge_id, channel, event_type, recipient, status,
       provider_message_id, error_message, attempts, sent_at
     ) VALUES ($1, $2::uuid, $3, $4, $5, $6, $7, $8, 1, CASE WHEN $6 = 'sent' THEN now() ELSE NULL END)`,
    [
      input.tenantId,
      input.chargeId,
      input.channel,
      input.eventType,
      input.recipient,
      input.status,
      input.providerMessageId ?? null,
      input.errorMessage ?? null
    ]
  );
}

export type NotificationSendProcessorDeps = {
  withTenant?: typeof withTenantTransaction;
  adapter?: NotificationAdapter;
};

export async function processNotificationSend(
  data: NotificationSendJobPayload,
  deps: NotificationSendProcessorDeps = {}
): Promise<void> {
  const withTenant = deps.withTenant ?? withTenantTransaction;
  const adapter = deps.adapter ?? createDefaultNotificationAdapter();

  await withTenant(data.tenantId, async (client) => {
    const chargeR = await client.query<{
      canonical_status: string;
      amount: string;
      due_date: Date | string;
      reference: string;
    }>(
      `SELECT canonical_status, amount::text, due_date, reference
       FROM charges WHERE id = $1::uuid AND tenant_id = $2::uuid LIMIT 1`,
      [data.chargeId, data.tenantId]
    );
    const charge = chargeR.rows[0];
    if (!charge) {
      return;
    }
    if (charge.canonical_status === "paga" || charge.canonical_status === "cancelada") {
      return;
    }

    const portalClienteId = (
      await client.query<{ portal_cliente_id: string | null }>(
        `SELECT metadata->>'portal_cliente_id' AS portal_cliente_id FROM charges WHERE id = $1::uuid`,
        [data.chargeId]
      )
    ).rows[0]?.portal_cliente_id;

    let nome = "Cliente";
    let email: string | null = null;
    let telefone: string | null = null;
    let optInEmail = true;
    let optInWhatsapp = false;

    if (portalClienteId) {
      const cl = await client.query<{
        nome: string;
        email: string | null;
        telefone: string | null;
        opt_in_email: boolean;
        opt_in_whatsapp: boolean;
      }>(
        `SELECT nome, email, telefone, opt_in_email, opt_in_whatsapp
         FROM portal.cliente WHERE id = $1::uuid LIMIT 1`,
        [portalClienteId]
      );
      const row = cl.rows[0];
      if (row) {
        nome = row.nome;
        email = row.email;
        telefone = row.telefone;
        optInEmail = row.opt_in_email;
        optInWhatsapp = row.opt_in_whatsapp;
      }
    }

    const payR = await client.query<{
      boleto_url: string | null;
      pix_link: string | null;
      pix_emv: string | null;
    }>(
      `SELECT boleto_url, pix_link, pix_emv
       FROM payment_transactions
       WHERE charge_id = $1::uuid
       ORDER BY created_at DESC LIMIT 1`,
      [data.chargeId]
    );
    const pay = payR.rows[0];

    const escritorioR = await client.query<{ razao_social: string | null }>(
      `SELECT razao_social FROM escritorio_config WHERE tenant_id = $1 LIMIT 1`,
      [data.tenantId]
    );

    const dueStr =
      charge.due_date instanceof Date
        ? charge.due_date.toISOString().slice(0, 10)
        : String(charge.due_date).slice(0, 10);

    const vars: Record<string, string> = {
      nome,
      valor: formatBrl(charge.amount),
      data_vencimento: formatDateBr(dueStr),
      link_boleto: pay?.boleto_url ?? "",
      link_pix: pay?.pix_link ?? "",
      pix_emv: pay?.pix_emv ?? "",
      escritorio_nome: escritorioR.rows[0]?.razao_social ?? "Escritorio",
      multa_percentual: "2",
      data_pagamento: formatDateBr(new Date().toISOString().slice(0, 10))
    };

    const force = data.forceChannel;
    const sendEmail = force === "email" || force === "both" || !force;
    const sendWhatsapp = force === "whatsapp" || force === "both" || !force;

    if (sendEmail && optInEmail && email?.trim()) {
      const tpl = await loadTemplate(client, data.tenantId, data.eventType, "email");
      if (tpl) {
        const html = renderTemplate(tpl.body_template, vars);
        try {
          const result = await adapter.sendEmail({
            to: email.trim(),
            subject: tpl.subject ? renderTemplate(tpl.subject, vars) : data.eventType,
            html
          });
          await insertCommunicationEvent(client, {
            tenantId: data.tenantId,
            chargeId: data.chargeId,
            channel: "email",
            eventType: data.eventType,
            recipient: email.trim(),
            status: "sent",
            providerMessageId: result.messageId
          });
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : String(error);
          await insertCommunicationEvent(client, {
            tenantId: data.tenantId,
            chargeId: data.chargeId,
            channel: "email",
            eventType: data.eventType,
            recipient: email.trim(),
            status: "failed",
            errorMessage: msg
          });
          throw error;
        }
      }
    }

    if (sendWhatsapp && optInWhatsapp && telefone?.trim()) {
      const tpl = await loadTemplate(client, data.tenantId, data.eventType, "whatsapp");
      if (tpl) {
        const message = renderTemplate(tpl.body_template, vars);
        try {
          const result = await adapter.sendWhatsApp({ phone: telefone.trim(), message });
          await insertCommunicationEvent(client, {
            tenantId: data.tenantId,
            chargeId: data.chargeId,
            channel: "whatsapp",
            eventType: data.eventType,
            recipient: telefone.trim(),
            status: "sent",
            providerMessageId: result.messageId
          });
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : String(error);
          await insertCommunicationEvent(client, {
            tenantId: data.tenantId,
            chargeId: data.chargeId,
            channel: "whatsapp",
            eventType: data.eventType,
            recipient: telefone.trim(),
            status: "failed",
            errorMessage: msg
          });
          throw error;
        }
      }
    }
  });
}
