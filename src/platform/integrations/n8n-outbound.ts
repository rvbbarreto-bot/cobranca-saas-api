/**
 * Webhooks outbound para orquestração n8n (Sprint 4.6).
 * No-op se `N8N_PLATFORM_WEBHOOK_URL` não estiver definida.
 */

export type N8nPlatformEventType =
  | "charge.paid"
  | "charge.overdue"
  | "charge.cancelled"
  | "notification.regua_enqueued"
  | "subscription.past_due";

export type N8nPlatformEvent = {
  event: N8nPlatformEventType;
  occurred_at: string;
  tenant_id: string;
  payload: Record<string, unknown>;
};

function platformWebhookUrl(): string | null {
  const url = process.env.N8N_PLATFORM_WEBHOOK_URL?.trim();
  return url && url.length > 0 ? url : null;
}

/** Envia evento para n8n sem bloquear o fluxo principal (fire-and-forget). */
export function emitN8nPlatformEvent(event: N8nPlatformEvent): void {
  const url = platformWebhookUrl();
  if (!url) {
    return;
  }

  const secret = process.env.N8N_PLATFORM_WEBHOOK_SECRET?.trim();
  const headers: Record<string, string> = {
    "Content-Type": "application/json"
  };
  if (secret) {
    headers["X-Webhook-Secret"] = secret;
  }

  void fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(event),
    signal: AbortSignal.timeout(10_000)
  }).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[n8n-outbound] falha ao enviar ${event.event}: ${message}`);
  });
}
