import { UnrecoverableError } from "bullmq";
import type { PoolClient } from "pg";
import type { NotificationAdapter } from "../../../modules/notifications/domain/notification.interface";
import { NotificationError } from "../../../modules/notifications/domain/notification-error";
import { renderTemplate } from "../../../modules/notifications/application/render-template";
import { ResendAdapter } from "../../../modules/notifications/infrastructure/resend/resend-adapter";
import { ZapiAdapter } from "../../../modules/notifications/infrastructure/zapi/zapi-adapter";
import { withTenantTransaction } from "../../persistence/with-tenant-transaction";
import type { NotificationSendJobPayload } from "../enqueue-notification";

export type NotificationChannel = "email" | "whatsapp" | "both";

type ChargeContextRow = {
  charge_id: string;
  tenant_id: string;
  canonical_status: string;
  amount: string;
  due_date: Date | string;
  paid_at: Date | string | null;
  cliente_nome: string;
  cliente_email: string | null;
  cliente_telefone: string | null;
  opt_in_email: boolean;
  opt_in_whatsapp: boolean;
  razao_social: string | null;
};

type TemplateRow = {
  channel: "email" | "whatsapp";
  subject: string | null;
  body_template: string;
};

export function formatCurrency(amount: string): string {
  const n = Number(amount);
  if (Number.isNaN(n)) return amount;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDate(value: Date | string | null | undefined): string {
  if (value == null) return "";
  const iso =
    value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

/** Telefone apenas com dígitos (sem +55). */
export function limparTelefone(telefone: string): string {
  return telefone.replace(/\D/g, "");
}

export function eventTypeToDaysOffset(eventType: string): number | undefined {
  const map: Record<string, number> = {
    lembrete_pre_3d: -3,
    lembrete_pre_1d: -1,
    vencimento_hoje: 0,
    pos_vencimento_3d: 3,
    pos_vencimento_7d: 7
  };
  return map[eventType];
}

export async function resolveNotificationChannel(
  client: PoolClient,
  tenantId: string,
  input: { forceChannel?: NotificationChannel; daysOffset?: number; eventType: string }
): Promise<NotificationChannel> {
  if (input.forceChannel) {
    return input.forceChannel;
  }

  const daysOffset =
    input.daysOffset ?? eventTypeToDaysOffset(input.eventType);
  if (daysOffset === undefined) {
    return "both";
  }

  const ruleR = await client.query<{ channel: NotificationChannel }>(
    `SELECT channel
     FROM charging_rules
     WHERE tenant_id = $1 AND days_offset = $2 AND is_active = true
     LIMIT 1`,
    [tenantId, daysOffset]
  );
  return ruleR.rows[0]?.channel ?? "both";
}

async function loadChargeContext(
  client: PoolClient,
  chargeId: string,
  tenantId: string
): Promise<ChargeContextRow | null> {
  const r = await client.query<ChargeContextRow>(
    `SELECT
       c.id::text AS charge_id,
       c.tenant_id::text AS tenant_id,
       c.canonical_status,
       c.amount::text AS amount,
       c.due_date,
       c.paid_at,
       cli.nome AS cliente_nome,
       cli.email AS cliente_email,
       cli.telefone AS cliente_telefone,
       cli.opt_in_email,
       cli.opt_in_whatsapp,
       ec.razao_social
     FROM charges c
     INNER JOIN portal.cliente cli
       ON cli.id = (NULLIF(c.metadata->>'portal_cliente_id', ''))::uuid
       AND cli.tenant_id = c.tenant_id::text
     INNER JOIN escritorio_config ec ON ec.tenant_id = c.tenant_id::text
     WHERE c.id = $1::uuid AND c.tenant_id = $2::uuid
     LIMIT 1`,
    [chargeId, tenantId]
  );
  return r.rows[0] ?? null;
}

async function loadTemplate(
  client: PoolClient,
  tenantId: string,
  eventType: string,
  channel: "email" | "whatsapp"
): Promise<TemplateRow | null> {
  const r = await client.query<TemplateRow>(
    `SELECT channel, subject, body_template
     FROM notification_templates
     WHERE event_type = $2
       AND channel = $3
       AND is_active = true
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
  resendAdapter?: Pick<NotificationAdapter, "sendEmail">;
  zapiAdapter?: Pick<NotificationAdapter, "sendWhatsApp">;
  log?: (message: string) => void;
};

export async function processNotificationSend(
  data: NotificationSendJobPayload,
  deps: NotificationSendProcessorDeps = {}
): Promise<void> {
  const withTenant = deps.withTenant ?? withTenantTransaction;
  const resend = deps.resendAdapter ?? new ResendAdapter();
  const zapi = deps.zapiAdapter ?? new ZapiAdapter();
  const log = deps.log ?? (() => undefined);

  await withTenant(data.tenantId, async (client) => {
    const ctx = await loadChargeContext(client, data.chargeId, data.tenantId);
    if (!ctx) {
      throw new UnrecoverableError("charge_not_found");
    }

    if (ctx.canonical_status === "paga" || ctx.canonical_status === "cancelada") {
      log(`Notificação ignorada: cobrança ${data.chargeId} já em estado terminal`);
      return;
    }

    const channel = await resolveNotificationChannel(client, data.tenantId, {
      forceChannel: data.forceChannel,
      daysOffset: data.daysOffset,
      eventType: data.eventType
    });

    const payR = await client.query<{
      boleto_url: string | null;
      pix_link: string | null;
      pix_emv: string | null;
    }>(
      `SELECT boleto_url, pix_link, pix_emv
       FROM payment_transactions
       WHERE charge_id = $1::uuid
       ORDER BY created_at DESC
       LIMIT 1`,
      [data.chargeId]
    );
    const pay = payR.rows[0];

    const vars: Record<string, string> = {
      nome: ctx.cliente_nome,
      valor: formatCurrency(ctx.amount),
      data_vencimento: formatDate(ctx.due_date),
      link_boleto: pay?.boleto_url ?? "",
      link_pix: pay?.pix_link ?? "",
      pix_emv: pay?.pix_emv ?? "",
      escritorio_nome: ctx.razao_social ?? "Escritório",
      multa_percentual: "2",
      data_pagamento: formatDate(ctx.paid_at)
    };

    const sendEmail = channel === "email" || channel === "both";
    const sendWhatsapp = channel === "whatsapp" || channel === "both";

    if (sendEmail && ctx.opt_in_email && ctx.cliente_email?.trim()) {
      const tpl = await loadTemplate(client, data.tenantId, data.eventType, "email");
      if (tpl) {
        const html = renderTemplate(tpl.body_template, vars);
        const subject = tpl.subject
          ? renderTemplate(tpl.subject, vars)
          : data.eventType;
        const recipient = ctx.cliente_email.trim();
        try {
          const result = await resend.sendEmail({
            to: recipient,
            subject,
            html
          });
          await insertCommunicationEvent(client, {
            tenantId: data.tenantId,
            chargeId: data.chargeId,
            channel: "email",
            eventType: data.eventType,
            recipient,
            status: "sent",
            providerMessageId: result.messageId
          });
        } catch (error: unknown) {
          if (error instanceof NotificationError) {
            await insertCommunicationEvent(client, {
              tenantId: data.tenantId,
              chargeId: data.chargeId,
              channel: "email",
              eventType: data.eventType,
              recipient,
              status: "failed",
              errorMessage: error.message
            });
          }
          throw error;
        }
      }
    }

    if (sendWhatsapp && ctx.opt_in_whatsapp && ctx.cliente_telefone?.trim()) {
      const tpl = await loadTemplate(client, data.tenantId, data.eventType, "whatsapp");
      if (tpl) {
        const message = renderTemplate(tpl.body_template, vars);
        const recipient = ctx.cliente_telefone.trim();
        try {
          const result = await zapi.sendWhatsApp({
            phone: limparTelefone(recipient),
            message
          });
          await insertCommunicationEvent(client, {
            tenantId: data.tenantId,
            chargeId: data.chargeId,
            channel: "whatsapp",
            eventType: data.eventType,
            recipient,
            status: "sent",
            providerMessageId: result.messageId
          });
        } catch (error: unknown) {
          if (error instanceof NotificationError) {
            await insertCommunicationEvent(client, {
              tenantId: data.tenantId,
              chargeId: data.chargeId,
              channel: "whatsapp",
              eventType: data.eventType,
              recipient,
              status: "failed",
              errorMessage: error.message
            });
          }
          throw error;
        }
      }
    }
  });
}
