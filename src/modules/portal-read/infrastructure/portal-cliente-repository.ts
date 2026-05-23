import type { Pool } from "pg";
import { getPool } from "../../../platform/persistence/pool";
import type { PortalClienteCreateInput, PortalClientePatchInput } from "../application/portal-cliente-input";

export type PortalClienteRow = {
  id: string;
  tenant_id: string;
  documento: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  whatsapp_opt_in: boolean;
  created_at: string;
  updated_at: string;
};

function mapRow(row: Record<string, unknown>): PortalClienteRow {
  return {
    id: String(row.id),
    tenant_id: String(row.tenant_id),
    documento: String(row.documento),
    nome: String(row.nome),
    email: row.email ? String(row.email) : null,
    telefone: row.telefone ? String(row.telefone) : null,
    whatsapp_opt_in: Boolean(row.whatsapp_opt_in),
    created_at:
      row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updated_at:
      row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at)
  };
}

export async function getClienteByIdForTenant(
  id: string,
  automacaoTenantId: string,
  pool: Pool = getPool()
): Promise<PortalClienteRow | null> {
  const r = await pool.query<Record<string, unknown>>(
    `SELECT id, tenant_id, documento, nome, email, telefone, whatsapp_opt_in, created_at, updated_at
     FROM portal.cliente
     WHERE id = $1::uuid AND tenant_id = $2
     LIMIT 1`,
    [id, automacaoTenantId]
  );
  const row = r.rows[0];
  return row ? mapRow(row) : null;
}

export async function listClientesByTenant(tenantId: string, pool: Pool = getPool()): Promise<PortalClienteRow[]> {
  const r = await pool.query<Record<string, unknown>>(
    `SELECT id, tenant_id, documento, nome, email, telefone, whatsapp_opt_in, created_at, updated_at
     FROM portal.cliente
     WHERE tenant_id = $1
     ORDER BY nome ASC`,
    [tenantId]
  );
  return r.rows.map(mapRow);
}

export type ClienteKeysetCursor = { nome: string; id: string };

export async function listClientesByTenantPage(
  tenantId: string,
  options: { limit: number; cursor?: ClienteKeysetCursor | null; search?: string | null },
  pool: Pool = getPool()
): Promise<{ items: PortalClienteRow[]; has_more: boolean }> {
  const lim = Math.min(Math.max(Math.floor(options.limit), 1), 200);
  const fetchN = lim + 1;
  const params: unknown[] = [tenantId];
  let p = 2;
  let where = `WHERE tenant_id = $1`;
  const search = options.search?.trim();
  if (search) {
    const term = `%${search.replace(/%/g, "")}%`;
    const digits = search.replace(/\D/g, "");
    where += ` AND (nome ILIKE $${p} OR documento ILIKE $${p}`;
    params.push(term);
    p += 1;
    if (digits.length >= 3) {
      where += ` OR documento LIKE $${p}`;
      params.push(`%${digits}%`);
      p += 1;
    }
    where += `)`;
  }
  if (options.cursor) {
    where += ` AND (nome, id) > ($${p}::text, $${p + 1}::uuid)`;
    params.push(options.cursor.nome, options.cursor.id);
    p += 2;
  }
  params.push(fetchN);
  const r = await pool.query<Record<string, unknown>>(
    `SELECT id, tenant_id, documento, nome, email, telefone, whatsapp_opt_in, created_at, updated_at
     FROM portal.cliente
     ${where}
     ORDER BY nome ASC, id ASC
     LIMIT $${p}`,
    params
  );
  const mapped = r.rows.map(mapRow);
  const has_more = mapped.length > lim;
  const items = has_more ? mapped.slice(0, lim) : mapped;
  return { items, has_more };
}

export async function insertCliente(
  tenantId: string,
  input: PortalClienteCreateInput,
  pool: Pool = getPool()
): Promise<PortalClienteRow> {
  const tipoDocumento = input.documento.length === 14 ? "cnpj" : "cpf";

  const r = await pool.query<Record<string, unknown>>(
    `INSERT INTO portal.cliente (
       tenant_id, documento, tipo_documento, nome, email, telefone, whatsapp_opt_in, opt_in_whatsapp
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
     RETURNING id, tenant_id, documento, nome, email, telefone, whatsapp_opt_in, created_at, updated_at`,
    [tenantId, input.documento, tipoDocumento, input.nome, input.email, input.telefone, input.whatsappOptIn]
  );
  const row = r.rows[0];
  if (!row) {
    throw new Error("Falha ao inserir portal.cliente.");
  }
  return mapRow(row);
}

export async function updateClienteForTenant(
  id: string,
  tenantId: string,
  patch: PortalClientePatchInput,
  pool: Pool = getPool()
): Promise<PortalClienteRow | null> {
  const current = await getClienteByIdForTenant(id, tenantId, pool);
  if (!current) {
    return null;
  }

  const nome = patch.nome !== undefined ? patch.nome : current.nome;
  const email = patch.email !== undefined ? patch.email : current.email;
  const telefone = patch.telefone !== undefined ? patch.telefone : current.telefone;
  const whatsappOptIn = patch.whatsappOptIn !== undefined ? patch.whatsappOptIn : current.whatsapp_opt_in;

  if (whatsappOptIn && !telefone?.trim()) {
    throw new Error("portal_cliente_telefone_required_for_optin");
  }

  const r = await pool.query<Record<string, unknown>>(
    `UPDATE portal.cliente
     SET nome = $3, email = $4, telefone = $5, whatsapp_opt_in = $6, updated_at = now()
     WHERE id = $1::uuid AND tenant_id = $2
     RETURNING id, tenant_id, documento, nome, email, telefone, whatsapp_opt_in, created_at, updated_at`,
    [id, tenantId, nome, email, telefone, whatsappOptIn]
  );
  const row = r.rows[0];
  return row ? mapRow(row) : null;
}
