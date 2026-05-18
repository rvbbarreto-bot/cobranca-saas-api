export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  attachments?: Array<{ filename: string; content: string }>;
};

export type SendWhatsAppInput = {
  phone: string;
  message: string;
};

export type NotificationAdapter = {
  sendEmail(input: SendEmailInput): Promise<{ messageId: string }>;
  sendWhatsApp(input: SendWhatsAppInput): Promise<{ messageId: string }>;
};
