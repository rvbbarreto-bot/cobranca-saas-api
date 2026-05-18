import type { NotificationAdapter, SendEmailInput } from "../../domain/notification.interface";
import { NotificationError } from "../../domain/notification-error";

export class ResendAdapter implements NotificationAdapter {
  constructor(
    private readonly apiKey = process.env.RESEND_API_KEY?.trim() ?? "",
    private readonly fromEmail = process.env.RESEND_FROM_EMAIL?.trim() ?? "cobrancas@suaempresa.com.br"
  ) {}

  async sendEmail(input: SendEmailInput): Promise<{ messageId: string }> {
    if (!this.apiKey) {
      throw new NotificationError("RESEND_API_KEY ausente.");
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: this.fromEmail,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        attachments: input.attachments
      })
    });

    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) {
      throw new NotificationError(body.message ?? `Resend HTTP ${res.status}`, res.status);
    }
    return { messageId: body.id ?? `resend-${Date.now()}` };
  }

  async sendWhatsApp(): Promise<{ messageId: string }> {
    throw new NotificationError("ResendAdapter nao envia WhatsApp.");
  }
}
