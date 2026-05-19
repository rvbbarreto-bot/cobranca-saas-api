export class NotificationError extends Error {
  constructor(
    message: string,
    public readonly channel: "email" | "whatsapp",
    public readonly provider: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = "NotificationError";
  }
}
