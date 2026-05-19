import type {
  NotificationAdapter,
  NotificationResult,
  SendEmailInput
} from "../../domain/notification.interface";
import { NotificationError } from "../../domain/notification-error";

const RESEND_URL = "https://api.resend.com/emails";
const TIMEOUT_MS = 10_000;

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
      throw new NotificationError(`Resend timeout após ${timeoutMs}ms`, "email", "resend");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export class ResendAdapter implements NotificationAdapter {
  constructor(
    private readonly apiKey = process.env.RESEND_API_KEY?.trim() ?? "",
    private readonly fromEmail = process.env.RESEND_FROM_EMAIL?.trim() ?? "cobrancas@suaempresa.com.br"
  ) {}

  async sendEmail(input: SendEmailInput): Promise<NotificationResult> {
    if (!this.apiKey) {
      throw new NotificationError("RESEND_API_KEY ausente.", "email", "resend");
    }

    const body: Record<string, unknown> = {
      from: this.fromEmail,
      to: [input.to],
      subject: input.subject,
      html: input.html
    };

    if (input.attachments?.length) {
      body.attachments = input.attachments.map((a) => ({
        filename: a.filename,
        content: a.content.toString("base64")
      }));
    }

    const res = await fetchWithTimeout(
      RESEND_URL,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      },
      TIMEOUT_MS
    );

    const payload = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) {
      throw new NotificationError(
        payload.message ?? `Resend HTTP ${res.status}`,
        "email",
        "resend",
        res.status
      );
    }

    return { messageId: payload.id ?? `resend-${Date.now()}` };
  }

  async sendWhatsApp(): Promise<NotificationResult> {
    throw new NotificationError("ResendAdapter nao envia WhatsApp.", "email", "resend");
  }
}
