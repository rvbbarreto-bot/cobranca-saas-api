import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "../../../shared/types/request-context";

export function requireRoles(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const auth = req.authContext;
    if (!auth) {
      res.status(401).json({
        error: "unauthorized",
        message: "Contexto de autenticacao nao encontrado."
      });
      return;
    }

    const granted = auth.roles.some((role) => allowedRoles.includes(role));
    if (!granted) {
      res.status(403).json({
        error: "forbidden",
        message: "Perfil sem permissao para este recurso."
      });
      return;
    }

    next();
  };
}
