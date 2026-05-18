export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  attachments?: { filename: string; content: Buffer }[];
}

export interface SendWhatsAppInput {
  /** Apenas dígitos, sem +55 */
  phone: string;
  /** Máximo 1024 caracteres (truncado no adapter) */
  message: string;
}

export interface NotificationResult {
  messageId: string;
}

export interface NotificationAdapter {
  sendEmail(input: SendEmailInput): Promise<NotificationResult>;
  sendWhatsApp(input: SendWhatsAppInput): Promise<NotificationResult>;
}
