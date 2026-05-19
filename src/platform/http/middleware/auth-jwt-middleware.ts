import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../../../modules/identity-access/application/jwt-service";

export function authJwtMiddleware(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.header("authorization") || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    res.status(401).json({
      error: "unauthorized",
      message: "Token Bearer ausente."
    });
    return;
  }

  try {
    const claims = verifyAccessToken(token);

    if (!req.tenantContext) {
      res.status(400).json({
        error: "tenant_context_missing",
        message: "Tenant context nao resolvido antes da autenticacao."
      });
      return;
    }

    if (claims.tid !== req.tenantContext.tenantId) {
      res.status(403).json({
        error: "cross_tenant_forbidden",
        message: "Token de tenant diferente do tenant da requisicao."
      });
      return;
    }

    req.authContext = {
      userId: claims.sub,
      tenantId: claims.tid,
      roles: claims.roles
    };

    next();
  } catch (error) {
    res.status(401).json({
      error: "invalid_token",
      message: error instanceof Error ? error.message : "JWT invalido."
    });
  }
}
