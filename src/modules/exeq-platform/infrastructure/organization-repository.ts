import type { Pool, PoolClient } from "pg";
import type { OrganizationRow } from "../domain/organization-types";

const SELECT_ORG = `
  SELECT
    o.id::text AS id,
    o.slug,
    o.name,
    o.type,
    o.status,
    o.parent_organization_id::text AS parent_organization_id,
    ot.automacao_tenant_id,
    o.created_at,
    o.updated_at
  FROM portal.organization o
  LEFT JOIN portal.organization_tenant ot ON ot.organization_id = o.id
`;

function mapRow(row: {
  id: string;
  slug: string;
  name: string;
  type: string;
  status: string;
  parent_organization_id: string | null;
  automacao_tenant_id: string | null;
  created_at: Date;
  updated_at: Date;
}): OrganizationRow {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    type: row.type as OrganizationRow["type"],
    status: row.status as OrganizationRow["status"],
    parentOrganizationId: row.parent_organization_id,
    automacaoTenantId: row.automacao_tenant_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

export async function listOrganizations(pool: Pool): Promise<OrganizationRow[]> {
  const r = await pool.query(`${SELECT_ORG} ORDER BY lower(o.name), o.slug`);
  return r.rows.map(mapRow);
}

export async function getOrganizationById(
  pool: Pool,
  organizationId: string
): Promise<OrganizationRow | null> {
  const r = await pool.query(`${SELECT_ORG} WHERE o.id = $1::uuid LIMIT 1`, [organizationId]);
  const row = r.rows[0];
  return row ? mapRow(row) : null;
}

export async function getOrganizationByAutomacaoTenantId(
  pool: Pool,
  automacaoTenantId: string
): Promise<OrganizationRow | null> {
  const r = await pool.query(
    `${SELECT_ORG} WHERE ot.automacao_tenant_id = $1 LIMIT 1`,
    [automacaoTenantId]
  );
  const row = r.rows[0];
  return row ? mapRow(row) : null;
}

export async function ensureOrganizationForEscritorio(
  client: PoolClient,
  input: { automacaoTenantId: string; slug: string; name: string }
): Promise<string> {
  const slug = input.slug.trim().toLowerCase();
  const orgIns = await client.query<{ id: string }>(
    `INSERT INTO portal.organization (slug, name, type, status)
     VALUES ($1, $2, 'escritorio', 'active')
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, updated_at = now()
     RETURNING id::text AS id`,
    [slug, input.name.trim()]
  );
  const orgId = orgIns.rows[0]?.id;
  if (!orgId) {
    throw new Error("Falha ao criar portal.organization.");
  }

  await client.query(
    `INSERT INTO portal.organization_tenant (organization_id, automacao_tenant_id)
     VALUES ($1::uuid, $2)
     ON CONFLICT (automacao_tenant_id) DO UPDATE
       SET organization_id = EXCLUDED.organization_id`,
    [orgId, input.automacaoTenantId]
  );

  return orgId;
}
