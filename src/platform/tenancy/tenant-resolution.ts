import type { Request } from "express";
import { z } from "zod";

const tenantHeaderSchema = z.string().min(2).max(128);

function parseTenantFromSubdomain(host?: string): string | undefined {
  if (!host) return undefined;
  const cleanHost = host.split(":")[0];
  const parts = cleanHost.split(".");
  if (parts.length < 3) return undefined;
  const subdomain = parts[0]?.trim();
  return subdomain || undefined;
}

/**
 * Extrai identificador bruto (UUID ou slug) de header ou subdominio.
 */
export function getTenantRawCandidate(req: Request): string | null {
  const headerTenant = req.header("x-tenant-id");
  const subdomainTenant = parseTenantFromSubdomain(req.header("host"));
  const candidate = headerTenant ?? subdomainTenant;
  if (!candidate) return null;
  const parsed = tenantHeaderSchema.safeParse(candidate.trim());
  return parsed.success ? parsed.data : null;
}
