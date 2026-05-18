import type { Pool } from "pg";
import { getPool } from "../../../platform/persistence/pool";

export type NfKeysetCursor = { createdAtIso: string | null; id: string };

export type NotaFiscalResumoRow = {
  id: string | null;
  referencia_externa: string | null;
  chat_id: string | null;
  tipo_documento: string | null;
  ambiente: string | null;
  data_emissao: string | null;
  data_competencia: string | null;
  natureza_operacao: string | null;
  cpf_cnpj_tomador: string | null;
  nome_tomador: string | null;
  descricao_servico: string | null;
  valor_servicos: string | null;
  status_emissao: string | null;
  status_focus: string | null;
  numero_nfse: string | null;
  codigo_verificacao: string | null;
  created_at: Date | null;
  updated_at: Date | null;
  tenant_id: string | null;
  tenant_uuid_text: string | null;
  tenant_slug: string | null;
  tenant_nome: string | null;
};

const LIST_SQL = `
  SELECT
    id,
    referencia_externa,
    chat_id,
    tipo_documento,
    ambiente,
    data_emissao::text,
    data_competencia::text,
    natureza_operacao,
    cpf_cnpj_tomador,
    nome_tomador,
    descricao_servico,
    valor_servicos::text,
    status_emissao,
    status_focus,
    numero_nfse,
    codigo_verificacao,
    created_at,
    updated_at,
    tenant_id,
    tenant_uuid_text,
    tenant_slug,
    tenant_nome
  FROM portal.vw_notas_fiscais_resumo
  WHERE tenant_id = $1
  ORDER BY COALESCE(created_at, '-infinity'::timestamptz) DESC, NULLIF(trim(id), '')::bigint DESC
  LIMIT 500
`;

export async function listNotasFiscaisResumoByTenant(tenantId: string, pool: Pool = getPool()): Promise<NotaFiscalResumoRow[]> {
  const r = await pool.query<NotaFiscalResumoRow>(LIST_SQL, [tenantId]);
  return r.rows;
}

/**
 * Paginação por cursor (P1): ordenação estável alinhada ao `ORDER BY` acima.
 */
export async function listNotasFiscaisResumoByTenantPage(
  tenantId: string,
  options: { limit: number; cursor?: NfKeysetCursor | null },
  pool: Pool = getPool()
): Promise<{ items: NotaFiscalResumoRow[]; has_more: boolean }> {
  const lim = Math.min(Math.max(Math.floor(options.limit), 1), 200);
  const fetchN = lim + 1;
  const hasCursor = Boolean(options.cursor);
  const ca = options.cursor?.createdAtIso ?? null;
  const idStr = options.cursor?.id ?? null;

  const r = await pool.query<NotaFiscalResumoRow>(
    `
  SELECT
    id,
    referencia_externa,
    chat_id,
    tipo_documento,
    ambiente,
    data_emissao::text,
    data_competencia::text,
    natureza_operacao,
    cpf_cnpj_tomador,
    nome_tomador,
    descricao_servico,
    valor_servicos::text,
    status_emissao,
    status_focus,
    numero_nfse,
    codigo_verificacao,
    created_at,
    updated_at,
    tenant_id,
    tenant_uuid_text,
    tenant_slug,
    tenant_nome
  FROM portal.vw_notas_fiscais_resumo
  WHERE tenant_id = $1
  AND (
    NOT $2::bool OR (
      COALESCE(created_at, '-infinity'::timestamptz),
      NULLIF(trim(id), '')::bigint
    ) < (
      COALESCE($3::timestamptz, '-infinity'::timestamptz),
      NULLIF(trim($4), '')::bigint
    )
  )
  ORDER BY COALESCE(created_at, '-infinity'::timestamptz) DESC, NULLIF(trim(id), '')::bigint DESC
  LIMIT $5
  `,
    [tenantId, hasCursor, ca, idStr, fetchN]
  );

  const rows = r.rows;
  const has_more = rows.length > lim;
  const items = has_more ? rows.slice(0, lim) : rows;
  return { items, has_more };
}
