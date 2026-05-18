import type { NextFunction, Request, Response } from "express";
import { isMockAuthRoutesEnabled } from "../../config/runtime-flags";

/**
 * Bloqueia rotas mock de autenticacao/provisionamento quando desabilitadas (producao ou ENABLE_MOCK_AUTH=false).
 * Usa 404 para nao expor superficie de debug.
 */
export function mockAuthRoutesGate(_req: Request, res: Response, next: NextFunction): void {
  if (!isMockAuthRoutesEnabled()) {
    res.status(404).json({
      error: "not_found",
      message: "Rota indisponivel neste ambiente."
    });
    return;
  }
  next();
}
