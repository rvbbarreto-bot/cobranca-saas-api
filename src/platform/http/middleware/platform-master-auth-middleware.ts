import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../../../modules/identity-access/application/jwt-service";
import { EXEQ_PLATFORM_TENANT_ID } from "../../../modules/exeq-platform/domain/exeq-platform-constants";
import { getPool } from "../../persistence/pool";

/**
 * Autentica JWT do console master EXEQ.
 * Não exige x-tenant-id nem membership de escritório.
 */
export async function platformMasterAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
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
    if (claims.tid !== EXEQ_PLATFORM_TENANT_ID) {
      res.status(403).json({
        error: "platform_master_forbidden",
        message: "Token invalido para o console master EXEQ."
      });
      return;
    }

    const pool = getPool();
    const r = await pool.query<{ is_platform_master: boolean; email: string; full_name: string | null }>(
      `SELECT is_platform_master, email, full_name
       FROM portal.app_user
       WHERE id = $1::uuid
       LIMIT 1`,
      [claims.sub]
    );
    const row = r.rows[0];
    if (!row?.is_platform_master) {
      res.status(403).json({
        error: "platform_master_forbidden",
        message: "Usuario sem permissao de master EXEQ."
      });
      return;
    }

    req.authContext = {
      userId: claims.sub,
      tenantId: claims.tid,
      roles: claims.roles
    };
    req.platformMasterUser = {
      email: row.email,
      fullName: row.full_name
    };

    next();
  } catch (error) {
    res.status(401).json({
      error: "invalid_token",
      message: error instanceof Error ? error.message : "JWT invalido."
    });
  }
}
