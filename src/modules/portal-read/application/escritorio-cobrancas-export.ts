import type { PoolClient } from "pg";

export const CSV_EXPORT_HEADERS = [
  "id",
  "created_at",
  "due_date",
  "paid_at",
  "canonical_status",
  "amount",
  "description",
  "type",
  "cliente_nome",
  "cliente_documento_mascarado",
  "boleto_barcode",
  "gateway_transaction_id"
] as const;

const EXPORT_ROW_LIMIT = 10_000;
const CURSOR_BATCH_SIZE = 500;
const CURSOR_NAME = "cobrancas_export_cur";

export function maskDocumentoForCsv(doc: string | null): string {
  if (!doc) return "";
  const d = doc.replace(/\D/g, "");
  if (d.length < 4) return "***";
  return `***${d.slice(-4)}`;
}

export function formatDateBr(value: unknown): string {
  if (value == null || value === "") return "";
  const iso =
    value instanceof Date
      ? value.toISOString().slice(0, 10)
      : String(value).trim().slice(0, 10);
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y}`;
}

export function formatCurrencyBr(value: unknown): string {
  if (value == null || value === "") return "";
  const n = Number(String(value).replace(",", "."));
  if (Number.isNaN(n)) return String(value);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function escapeCsvCell(value: string): string {
  if (value.includes('"') || value.includes(",") || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function formatCsvRow(cells: string[]): string {
  return `${cells.map(escapeCsvCell).join(",")}\n`;
}

export type CobrancaExportFilters = {
  status?: string;
  dataInicio?: string;
  dataFim?: string;
};

function buildExportQuery(filters: CobrancaExportFilters): { sql: string; params: unknown[] } {
  const params: unknown[] = [];
  const where: string[] = [];
  let idx = 1;

  where.push(`c.tenant_id = $${idx}::uuid`);
  params.push(null); // placeholder — tenant preenchido pelo caller
  idx += 1;

  if (filters.status?.trim()) {
    where.push(`c.canonical_status = $${idx}`);
    params.push(filters.status.trim());
    idx += 1;
  }
  if (filters.dataInicio?.trim() && filters.dataFim?.trim()) {
    where.push(`c.created_at::date BETWEEN $${idx}::date AND $${idx + 1}::date`);
    params.push(filters.dataInicio.trim(), filters.dataFim.trim());
    idx += 2;
  } else {
    if (filters.dataInicio?.trim()) {
      where.push(`c.created_at::date >= $${idx}::date`);
      params.push(filters.dataInicio.trim());
      idx += 1;
    }
    if (filters.dataFim?.trim()) {
      where.push(`c.created_at::date <= $${idx}::date`);
      params.push(filters.dataFim.trim());
      idx += 1;
    }
  }

  const sql = `
    SELECT
      c.id::text,
      c.created_at,
      c.due_date,
      c.paid_at,
      c.canonical_status,
      c.amount::text,
      c.reference AS description,
      c.type,
      cli.nome AS cliente_nome,
      cli.documento AS cliente_documento,
      pt.boleto_barcode,
      pt.gateway_transaction_id
    FROM charges c
    LEFT JOIN portal.cliente cli ON cli.id = COALESCE(
      c.customer_id,
      (NULLIF(c.metadata->>'portal_cliente_id', ''))::uuid
    )
    LEFT JOIN LATERAL (
      SELECT boleto_barcode, gateway_transaction_id
      FROM payment_transactions
      WHERE charge_id = c.id
      ORDER BY created_at DESC
      LIMIT 1
    ) pt ON true
    WHERE ${where.join(" AND ")}
    ORDER BY c.created_at DESC
    LIMIT ${EXPORT_ROW_LIMIT}`;

  return { sql, params };
}

function mapRowToCsvCells(rec: Record<string, unknown>): string[] {
  return [
    String(rec.id ?? ""),
    formatDateBr(rec.created_at),
    formatDateBr(rec.due_date),
    formatDateBr(rec.paid_at),
    String(rec.canonical_status ?? ""),
    formatCurrencyBr(rec.amount),
    String(rec.description ?? ""),
    String(rec.type ?? ""),
    String(rec.cliente_nome ?? ""),
    maskDocumentoForCsv(rec.cliente_documento ? String(rec.cliente_documento) : null),
    String(rec.boleto_barcode ?? ""),
    String(rec.gateway_transaction_id ?? "")
  ];
}

export async function* streamCobrancasCsvRows(
  client: PoolClient,
  tenantId: string,
  filters: CobrancaExportFilters
): AsyncGenerator<string> {
  yield formatCsvRow([...CSV_EXPORT_HEADERS]);

  const { sql, params } = buildExportQuery(filters);
  params[0] = tenantId;

  await client.query("BEGIN");
  try {
    await client.query(`DECLARE ${CURSOR_NAME} NO SCROLL CURSOR FOR ${sql}`, params);

    let totalRows = 0;
    while (totalRows < EXPORT_ROW_LIMIT) {
      const batch = await client.query(
        `FETCH ${CURSOR_BATCH_SIZE} FROM ${CURSOR_NAME}`
      );
      if (batch.rows.length === 0) {
        break;
      }
      for (const row of batch.rows) {
        if (totalRows >= EXPORT_ROW_LIMIT) {
          break;
        }
        yield formatCsvRow(mapRowToCsvCells(row as Record<string, unknown>));
        totalRows += 1;
      }
      if (batch.rows.length < CURSOR_BATCH_SIZE) {
        break;
      }
    }

    await client.query(`CLOSE ${CURSOR_NAME}`);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}
