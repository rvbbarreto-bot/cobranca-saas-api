import type { Pool } from "pg";
import { getPool } from "../../../platform/persistence/pool";
import { enderecoInputToColumns } from "../application/portal-cliente-address";
import type { PortalClienteCreateInput, PortalClientePatchInput } from "../application/portal-cliente-input";
import { rethrowPortalClienteSchemaError } from "./portal-cliente-schema";

export type PortalClienteEnderecoDto = {
  cep: string;
  logradouro: string;
  numero: string | null;
  complemento: string | null;
  bairro: string;
  cidade: string;
  uf: string;
};

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
  endereco: PortalClienteEnderecoDto | null;
};

const CLIENTE_SELECT = `id, tenant_id, documento, nome, email, telefone, whatsapp_opt_in, created_at, updated_at,
  endereco_cep, endereco_logradouro, endereco_numero, endereco_complemento, endereco_bairro, endereco_cidade, endereco_uf`;

function mapEndereco(row: Record<string, unknown>): PortalClienteEnderecoDto | null {
  const cep = row.endereco_cep ? String(row.endereco_cep) : "";
  if (!cep) {
    return null;
  }
  return {
    cep,
    logradouro: String(row.endereco_logradouro ?? ""),
    numero: row.endereco_numero ? String(row.endereco_numero) : null,
    complemento: row.endereco_complemento ? String(row.endereco_complemento) : null,
    bairro: String(row.endereco_bairro ?? ""),
    cidade: String(row.endereco_cidade ?? ""),
    uf: String(row.endereco_uf ?? "").toUpperCase()
  };
}

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
      row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
    endereco: mapEndereco(row)
  };
}

export async function getClienteByIdForTenant(
  id: string,
  automacaoTenantId: string,
  pool: Pool = getPool()
): Promise<PortalClienteRow | null> {
  try {
    const r = await pool.query<Record<string, unknown>>(
      `SELECT ${CLIENTE_SELECT}
     FROM portal.cliente
     WHERE id = $1::uuid AND tenant_id = $2
     LIMIT 1`,
      [id, automacaoTenantId]
    );
    const row = r.rows[0];
    return row ? mapRow(row) : null;
  } catch (error) {
    rethrowPortalClienteSchemaError(error);
  }
}

export async function listClientesByTenant(tenantId: string, pool: Pool = getPool()): Promise<PortalClienteRow[]> {
  try {
    const r = await pool.query<Record<string, unknown>>(
      `SELECT ${CLIENTE_SELECT}
     FROM portal.cliente
     WHERE tenant_id = $1
     ORDER BY nome ASC`,
      [tenantId]
    );
    return r.rows.map(mapRow);
  } catch (error) {
    rethrowPortalClienteSchemaError(error);
  }
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
  try {
    const r = await pool.query<Record<string, unknown>>(
      `SELECT ${CLIENTE_SELECT}
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
  } catch (error) {
    rethrowPortalClienteSchemaError(error);
  }
}

export async function insertCliente(
  tenantId: string,
  input: PortalClienteCreateInput,
  pool: Pool = getPool()
): Promise<PortalClienteRow> {
  const tipoDocumento = input.documento.length === 14 ? "cnpj" : "cpf";
  const addr = enderecoInputToColumns(input.endereco);

  try {
    const r = await pool.query<Record<string, unknown>>(
      `INSERT INTO portal.cliente (
       tenant_id, documento, tipo_documento, nome, email, telefone, whatsapp_opt_in, opt_in_whatsapp,
       endereco_cep, endereco_logradouro, endereco_numero, endereco_complemento, endereco_bairro, endereco_cidade, endereco_uf
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8, $9, $10, $11, $12, $13, $14)
     RETURNING ${CLIENTE_SELECT}`,
      [
        tenantId,
        input.documento,
        tipoDocumento,
        input.nome,
        input.email,
        input.telefone,
        input.whatsappOptIn,
        addr.endereco_cep,
        addr.endereco_logradouro,
        addr.endereco_numero,
        addr.endereco_complemento,
        addr.endereco_bairro,
        addr.endereco_cidade,
        addr.endereco_uf
      ]
    );
    const row = r.rows[0];
    if (!row) {
      throw new Error("Falha ao inserir portal.cliente.");
    }
    return mapRow(row);
  } catch (error) {
    rethrowPortalClienteSchemaError(error);
  }
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

  let addrCols = enderecoInputToColumns(
    patch.endereco !== undefined
      ? patch.endereco
      : current.endereco
        ? {
            cep: current.endereco.cep,
            logradouro: current.endereco.logradouro,
            numero: current.endereco.numero,
            complemento: current.endereco.complemento,
            bairro: current.endereco.bairro,
            cidade: current.endereco.cidade,
            uf: current.endereco.uf
          }
        : null
  );
  if (patch.endereco === null) {
    addrCols = enderecoInputToColumns(null);
  }

  try {
    const r = await pool.query<Record<string, unknown>>(
      `UPDATE portal.cliente
     SET nome = $3, email = $4, telefone = $5, whatsapp_opt_in = $6,
         endereco_cep = $7, endereco_logradouro = $8, endereco_numero = $9,
         endereco_complemento = $10, endereco_bairro = $11, endereco_cidade = $12, endereco_uf = $13,
         updated_at = now()
     WHERE id = $1::uuid AND tenant_id = $2
     RETURNING ${CLIENTE_SELECT}`,
      [
        id,
        tenantId,
        nome,
        email,
        telefone,
        whatsappOptIn,
        addrCols.endereco_cep,
        addrCols.endereco_logradouro,
        addrCols.endereco_numero,
        addrCols.endereco_complemento,
        addrCols.endereco_bairro,
        addrCols.endereco_cidade,
        addrCols.endereco_uf
      ]
    );
    const row = r.rows[0];
    return row ? mapRow(row) : null;
  } catch (error) {
    rethrowPortalClienteSchemaError(error);
  }
}
