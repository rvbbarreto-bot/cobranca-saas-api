import type {
  NotificationAdapter,
  NotificationResult,
  SendWhatsAppInput
} from "../../domain/notification.interface";
import { NotificationError } from "../../domain/notification-error";

const TIMEOUT_MS = 15_000;

function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, "");
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new NotificationError(`Z-API timeout após ${timeoutMs}ms`, "whatsapp", "zapi");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export class ZapiAdapter implements NotificationAdapter {
  constructor(
    private readonly instanceId = process.env.ZAPI_INSTANCE_ID?.trim() ??
      process.env.ZAPI_INSTANCE?.trim() ??
      "",
    private readonly token = process.env.ZAPI_TOKEN?.trim() ?? "",
    private readonly clientToken = process.env.ZAPI_CLIENT_TOKEN?.trim() ?? ""
  ) {}

  async sendEmail(): Promise<NotificationResult> {
    throw new NotificationError("ZapiAdapter nao envia email.", "whatsapp", "zapi");
  }

  async sendWhatsApp(input: SendWhatsAppInput): Promise<NotificationResult> {
    if (!this.instanceId || !this.token) {
      throw new NotificationError(
        "ZAPI_INSTANCE_ID ou ZAPI_TOKEN ausente.",
        "whatsapp",
        "zapi"
      );
    }
    if (!this.clientToken) {
      throw new NotificationError("ZAPI_CLIENT_TOKEN ausente.", "whatsapp", "zapi");
    }

    const message = input.message.slice(0, 1024);
    const phone = `55${digitsOnly(input.phone)}`;
    const url = `https://api.z-api.io/instances/${this.instanceId}/token/${this.token}/send-text`;

    const res = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Client-Token": this.clientToken
        },
        body: JSON.stringify({
          phone,
          message,
          delayMessage: 2
        })
      },
      TIMEOUT_MS
    );

    const body = (await res.json().catch(() => ({}))) as {
      messageId?: string;
      zaapId?: string;
      error?: string;
      message?: string;
    };

    if (!res.ok) {
      throw new NotificationError(
        body.error ?? body.message ?? `Z-API HTTP ${res.status}`,
        "whatsapp",
        "zapi",
        res.status
      );
    }

    return {
      messageId: body.messageId ?? body.zaapId ?? `zapi-${Date.now()}`
    };
  }
}
