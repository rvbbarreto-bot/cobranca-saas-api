import type { Response } from "express";
import {
  GatewayCredentialsMissingError,
  GatewayCredentialsValidationError
} from "../../modules/payment-gateway/domain/payment-gateway-error";

/** Mapeia erros de credencial de gateway para 422 (evita 500 no PATCH config). */
export function respondGatewayCredentialError(res: Response, error: unknown): boolean {
  if (
    error instanceof GatewayCredentialsValidationError ||
    error instanceof GatewayCredentialsMissingError
  ) {
    res.status(422).json({
      error: "gateway_credentials_invalid",
      message: error.message
    });
    return true;
  }
  return false;
}
