export class NfseError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
    public readonly unrecoverable = false
  ) {
    super(message);
    this.name = "NfseError";
  }
}
