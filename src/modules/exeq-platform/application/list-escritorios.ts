import type { Pool } from "pg";
import {
  PORTAL_MODULE_LABELS,
  type PortalModuleFlags
} from "../domain/portal-module-keys";
import { getTenantModuleFlags } from "../infrastructure/tenant-module-repository";

export type EscritorioListItem = {
  automacaoTenantId: string;
  slug: string | null;
  name: string | null;
  active: boolean;
  publicTenantId: string | null;
  publicTenantSlug: string | null;
  publicTenantStatus: string | null;
  adminCount: number;
  operadorCount: number;
  modules: PortalModuleFlags;
  moduleLabels: typeof PORTAL_MODULE_LABELS;
};

export async function listEscritoriosForPlatformMaster(pool: Pool): Promise<EscritorioListItem[]> {
  const r = await pool.query<{
    automacao_tenant_id: string;
    slug: string | null;
    name: string | null;
    active: boolean;
    public_tenant_id: string | null;
    public_tenant_slug: string | null;
    public_tenant_status: string | null;
    admin_count: string;
    operador_count: string;
  }>(
    `SELECT
       t.id::text AS automacao_tenant_id,
       t.slug,
       t.nome AS name,
       COALESCE(t.ativo, true) AS active,
       pt.id::text AS public_tenant_id,
       pt.slug AS public_tenant_slug,
       pt.status AS public_tenant_status,
       COALESCE((
         SELECT count(*)::text FROM portal.membership m
         WHERE m.tenant_id = t.id::text AND m.role = 'admin_escritorio'
       ), '0') AS admin_count,
       COALESCE((
         SELECT count(*)::text FROM portal.membership m
         WHERE m.tenant_id = t.id::text AND m.role = 'operador'
       ), '0') AS operador_count
     FROM automacao.tenants t
     LEFT JOIN portal.billing_tenant_link btl ON btl.automacao_tenant_id = t.id::text
     LEFT JOIN tenants pt ON pt.id = btl.public_tenant_id
     ORDER BY lower(COALESCE(t.nome, t.slug, t.id::text))`
  );

  const items: EscritorioListItem[] = [];
  for (const row of r.rows) {
    const modules = await getTenantModuleFlags(pool, row.automacao_tenant_id);
    items.push({
      automacaoTenantId: row.automacao_tenant_id,
      slug: row.slug,
      name: row.name,
      active: row.active,
      publicTenantId: row.public_tenant_id,
      publicTenantSlug: row.public_tenant_slug,
      publicTenantStatus: row.public_tenant_status,
      adminCount: Number(row.admin_count) || 0,
      operadorCount: Number(row.operador_count) || 0,
      modules,
      moduleLabels: PORTAL_MODULE_LABELS
    });
  }
  return items;
}

export async function getEscritorioForPlatformMaster(
  pool: Pool,
  automacaoTenantId: string
): Promise<EscritorioListItem | null> {
  const items = await listEscritoriosForPlatformMaster(pool);
  return items.find((i) => i.automacaoTenantId === automacaoTenantId) ?? null;
}

export type EscritorioMembershipRow = {
  membershipId: string;
  appUserId: string;
  email: string;
  fullName: string | null;
  role: "admin_escritorio" | "operador";
  createdAt: string;
};

export async function listEscritorioMemberships(
  pool: Pool,
  automacaoTenantId: string
): Promise<EscritorioMembershipRow[]> {
  const r = await pool.query<{
    membership_id: string;
    app_user_id: string;
    email: string;
    full_name: string | null;
    role: string;
    created_at: Date;
  }>(
    `SELECT
       m.id::text AS membership_id,
       u.id::text AS app_user_id,
       u.email,
       u.full_name,
       m.role,
       m.created_at
     FROM portal.membership m
     INNER JOIN portal.app_user u ON u.id = m.app_user_id
     WHERE m.tenant_id = $1
       AND m.role IN ('admin_escritorio', 'operador')
     ORDER BY m.role, lower(u.email)`,
    [automacaoTenantId]
  );

  return r.rows.map((row) => ({
    membershipId: row.membership_id,
    appUserId: row.app_user_id,
    email: row.email,
    fullName: row.full_name,
    role: row.role as "admin_escritorio" | "operador",
    createdAt: row.created_at.toISOString()
  }));
}
