import type { NotificationAdapter, SendWhatsAppInput } from "../../domain/notification.interface";
import { NotificationError } from "../../domain/notification-error";

function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, "");
}

export class ZapiAdapter implements NotificationAdapter {
  constructor(
    private readonly instance = process.env.ZAPI_INSTANCE?.trim() ?? "",
    private readonly token = process.env.ZAPI_TOKEN?.trim() ?? ""
  ) {}

  async sendEmail(): Promise<{ messageId: string }> {
    throw new NotificationError("ZapiAdapter nao envia email.");
  }

  async sendWhatsApp(input: SendWhatsAppInput): Promise<{ messageId: string }> {
    if (!this.instance || !this.token) {
      throw new NotificationError("ZAPI_INSTANCE ou ZAPI_TOKEN ausente.");
    }
    const message = input.message.slice(0, 1024);
    const phone = `55${digitsOnly(input.phone)}`;
    const url = `https://api.z-api.io/instances/${this.instance}/token/${this.token}/send-text`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, message, delayMessage: 2 })
    });

    const body = (await res.json().catch(() => ({}))) as { messageId?: string; error?: string };
    if (!res.ok) {
      throw new NotificationError(body.error ?? `Z-API HTTP ${res.status}`, res.status);
    }
    return { messageId: body.messageId ?? `zapi-${Date.now()}` };
  }
}
