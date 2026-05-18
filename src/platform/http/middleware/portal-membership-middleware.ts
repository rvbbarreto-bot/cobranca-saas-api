import type { NextFunction, Request, Response } from "express";
import { parsePortalMembershipRole } from "../../../shared/types/portal-membership";
import { getPool } from "../../persistence/pool";

/**
 * Garante que o usuario JWT (`sub` = portal.app_user.id) possui membership no tenant corrente
 * e anexa papel (`portalMembership`) para RBAC do portal.
 */
export async function portalMembershipMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const auth = req.authContext;
  const tenant = req.tenantContext;
  if (!auth || !tenant) {
    res.status(500).json({
      error: "internal_error",
      message: "Contexto portal incompleto."
    });
    return;
  }

  try {
    const pool = getPool();
    const r = await pool.query<{ role: string; cpf_cnpj_cliente: string | null }>(
      `SELECT role, cpf_cnpj_cliente
       FROM portal.membership
       WHERE app_user_id = $1::uuid
         AND tenant_id = $2
       LIMIT 1`,
      [auth.userId, tenant.tenantId]
    );

    const row = r.rows[0];
    if (!row) {
      res.status(403).json({
        error: "portal_membership_forbidden",
        message: "Usuario sem vinculo portal para este tenant."
      });
      return;
    }

    const role = parsePortalMembershipRole(row.role);
    if (!role) {
      res.status(500).json({
        error: "portal_membership_invalid_role",
        message: "Papel de membership desconhecido no banco."
      });
      return;
    }

    req.portalMembership = {
      role,
      cpfCnpjCliente: row.cpf_cnpj_cliente
    };

    next();
  } catch (error) {
    next(error);
  }
}
