import type { NextFunction, Request, Response } from "express";
import { resolveAutomacaoTenantId } from "../../tenancy/resolve-automacao-tenant-id";

/**
 * Resolve `x-tenant-id` contra `automacao.tenants` (id texto ou slug).
 * Não usa `public.tenants` — necessário para o portal NF no mesmo banco do n8n.
 */
export async function portalAutomacaoTenantMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const raw = req.header("x-tenant-id")?.trim();
  if (!raw || raw.length > 256) {
    res.status(400).json({
      error: "tenant_resolution_failed",
      message: "Envie x-tenant-id com o id ou slug do tenant em automacao.tenants."
    });
    return;
  }

  try {
    const tenantId = await resolveAutomacaoTenantId(raw);
    if (!tenantId) {
      res.status(404).json({
        error: "unknown_tenant",
        message: "Tenant nao encontrado em automacao.tenants."
      });
      return;
    }

    req.tenantContext = {
      tenantId,
      tenantSlug: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw)
        ? undefined
        : raw
    };
    next();
  } catch (error) {
    next(error);
  }
}
