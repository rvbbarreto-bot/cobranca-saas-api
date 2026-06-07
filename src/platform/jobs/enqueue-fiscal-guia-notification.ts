import { emitN8nPlatformEvent } from "../integrations/n8n-outbound";
import { isJobsEnabled } from "./redis-connection";
import { getQueues, JOB_OPTS } from "./queues";
import type { NotificationSendJobPayload } from "./enqueue-notification";

export type GuiaDisponivelNotificationPayload = {
  tenantId: string;
  guiaId: string;
  portalClienteId: string;
  eventType: "guia.disponivel";
  forceChannel?: "whatsapp";
  metadata?: Record<string, string>;
};

export async function enqueueGuiaDisponivelNotification(
  payload: GuiaDisponivelNotificationPayload
): Promise<void> {
  if (!isJobsEnabled()) {
    return;
  }
  const jobPayload: NotificationSendJobPayload = {
    tenantId: payload.tenantId,
    eventType: payload.eventType,
    forceChannel: payload.forceChannel ?? "whatsapp",
    metadata: {
      guia_id: payload.guiaId,
      portal_cliente_id: payload.portalClienteId,
      ...(payload.metadata ?? {})
    }
  };
  const jobId = `guia-disponivel-${payload.guiaId}`;
  await getQueues().notificationSend.add("guia-disponivel", jobPayload, {
    ...JOB_OPTS.notification,
    jobId
  });

  emitN8nPlatformEvent({
    event: "fiscal.guia_disponivel_enqueued",
    occurred_at: new Date().toISOString(),
    tenant_id: payload.tenantId,
    payload: {
      guia_id: payload.guiaId,
      portal_cliente_id: payload.portalClienteId
    }
  });
}
