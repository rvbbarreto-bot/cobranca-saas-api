export class NotificationError extends Error {
  readonly statusCode: number | undefined;

  constructor(message: string, statusCode?: number) {
    super(message);
    this.name = "NotificationError";
    this.statusCode = statusCode;
  }
}
