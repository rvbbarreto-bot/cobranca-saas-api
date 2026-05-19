import type { NotificationAdapter, SendEmailInput, SendWhatsAppInput } from "../domain/notification.interface";
import { ResendAdapter } from "./resend/resend-adapter";
import { ZapiAdapter } from "./zapi/zapi-adapter";

/** Email via Resend + WhatsApp via Z-API. */
export function createDefaultNotificationAdapter(): NotificationAdapter {
  const resend = new ResendAdapter();
  const zapi = new ZapiAdapter();
  return {
    sendEmail: (input: SendEmailInput) => resend.sendEmail(input),
    sendWhatsApp: (input: SendWhatsAppInput) => zapi.sendWhatsApp(input)
  };
}
