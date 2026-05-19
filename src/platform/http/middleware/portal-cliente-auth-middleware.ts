import type { NextFunction, Request, Response } from "express";

/**
 * Exige JWT com role `cliente_cnpj` (portal do devedor).
 * Deve rodar após authJwtMiddleware e portalAutomacaoTenantMiddleware.
 */
export function portalClienteAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const auth = req.authContext;
  const tenant = req.tenantContext;
  if (!auth || !tenant) {
    res.status(500).json({
      error: "internal_error",
      message: "Contexto portal incompleto."
    });
    return;
  }

  if (!auth.roles.includes("cliente_cnpj")) {
    res.status(403).json({
      error: "portal_forbidden",
      message: "Acesso restrito ao portal do cliente."
    });
    return;
  }

  req.portalCliente = {
    clienteId: auth.userId,
    tenantId: tenant.tenantId,
    automacaoTenantId: tenant.tenantId,
    role: "cliente_cnpj"
  };
  next();
}
