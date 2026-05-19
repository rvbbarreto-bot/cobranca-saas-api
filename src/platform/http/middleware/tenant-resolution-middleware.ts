import type { NextFunction, Request, Response } from "express";
import { getTenantRawCandidate } from "../../tenancy/tenant-resolution";
import { resolveTenantUuid } from "../../tenancy/resolve-tenant-uuid";

export async function tenantResolutionMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const raw = getTenantRawCandidate(req);
    if (!raw) {
      res.status(400).json({
        error: "tenant_resolution_failed",
        message: "Tenant nao identificado. Envie x-tenant-id (UUID ou slug) ou subdominio valido."
      });
      return;
    }

    const uuid = await resolveTenantUuid(raw);
    if (!uuid) {
      res.status(404).json({
        error: "unknown_tenant",
        message: "Tenant nao encontrado ou DATABASE_URL invalido."
      });
      return;
    }

    const looksLikeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      raw
    );
    req.tenantContext = {
      tenantId: uuid,
      tenantSlug: looksLikeUuid ? undefined : raw
    };
    next();
  } catch (error) {
    next(error);
  }
}
