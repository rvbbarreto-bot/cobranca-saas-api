import { z } from "zod";
import type { Pool } from "pg";
import { getOrganizationByAutomacaoTenantId } from "../../exeq-platform/infrastructure/organization-repository";
import {
  getSerproConfigByOrganizationId,
  mapSerproConfigPublic,
  upsertSerproConfig
} from "../infrastructure/serpro-config-repository";

export async function getPortalSerproConfigUseCase(pool: Pool, automacaoTenantId: string) {
  const org = await getOrganizationByAutomacaoTenantId(pool, automacaoTenantId);
  if (!org) {
    return { ok: false as const, kind: "organization_not_found" as const };
  }

  const row = await getSerproConfigByOrganizationId(pool, org.id);
  if (!row) {
    return {
      ok: true as const,
      config: {
        organization_id: org.id,
        ambiente: "demo" as const,
        contratante_cnpj: "",
        serpro_enabled: false,
        consumer_key_configured: false,
        consumer_secret_configured: false,
        updated_at: null
      }
    };
  }

  return { ok: true as const, config: mapSerproConfigPublic(row) };
}

export const patchSerproConfigSchema = z.object({
  ambiente: z.enum(["demo", "prod"]).optional(),
  contratante_cnpj: z.string().min(14).max(18),
  consumer_key: z.string().min(8).optional(),
  consumer_secret: z.string().min(8).optional(),
  serpro_enabled: z.boolean().optional()
});

export async function patchPortalSerproConfigUseCase(
  pool: Pool,
  automacaoTenantId: string,
  raw: unknown
) {
  const parsed = patchSerproConfigSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, kind: "validation_error" as const, issues: parsed.error.issues };
  }

  const org = await getOrganizationByAutomacaoTenantId(pool, automacaoTenantId);
  if (!org) {
    return { ok: false as const, kind: "organization_not_found" as const };
  }

  try {
    const row = await upsertSerproConfig(pool, org.id, {
      ambiente: parsed.data.ambiente,
      contratanteCnpj: parsed.data.contratante_cnpj,
      consumerKey: parsed.data.consumer_key,
      consumerSecret: parsed.data.consumer_secret,
      serproEnabled: parsed.data.serpro_enabled
    });
    return { ok: true as const, config: mapSerproConfigPublic(row) };
  } catch (e) {
    if (e instanceof Error && e.message === "CNPJ_CONTRATANTE_INVALIDO") {
      return { ok: false as const, kind: "invalid_cnpj" as const };
    }
    throw e;
  }
}
