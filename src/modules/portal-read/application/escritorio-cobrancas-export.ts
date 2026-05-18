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
  "cliente_documento",
  "boleto_barcode",
  "numero_nfse",
  "gateway_transaction_id"
] as const;

export function maskDocumentoForCsv(doc: string | null): string {
  if (!doc) return "";
  const d = doc.replace(/\D/g, "");
  if (d.length < 4) return "***";
  return `***${d.slice(-4)}`;
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

export async function* streamCobrancasCsvRows(
  client: PoolClient,
  tenantId: string,
  filters: CobrancaExportFilters
): AsyncGenerator<string> {
  yield formatCsvRow([...CSV_EXPORT_HEADERS]);

  const params: unknown[] = [tenantId];
  const where: string[] = ["c.tenant_id = $1::uuid"];
  let idx = 2;

  if (filters.status?.trim()) {
    where.push(`c.canonical_status = $${idx}`);
    params.push(filters.status.trim());
    idx += 1;
  }
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
      pt.barcode AS boleto_barcode,
      n.numero_nfse,
      pt.gateway_transaction_id
    FROM charges c
    LEFT JOIN portal.cliente cli ON cli.id = COALESCE(
      c.customer_id,
      (NULLIF(c.metadata->>'portal_cliente_id', ''))::uuid
    )
    LEFT JOIN LATERAL (
      SELECT barcode, gateway_transaction_id
      FROM payment_transactions
      WHERE charge_id = c.id
      ORDER BY created_at DESC
      LIMIT 1
    ) pt ON true
    LEFT JOIN nfse_emissions n ON n.charge_id = c.id AND n.status = 'autorizado'
    WHERE ${where.join(" AND ")}
    ORDER BY c.created_at DESC
    LIMIT 10000`;

  const r = await client.query(sql, params);
  for (const row of r.rows) {
    const rec = row as Record<string, unknown>;
    const fmtDate = (v: unknown) =>
      v instanceof Date ? v.toISOString() : v ? String(v) : "";
    yield formatCsvRow([
      String(rec.id ?? ""),
      fmtDate(rec.created_at),
      fmtDate(rec.due_date),
      fmtDate(rec.paid_at),
      String(rec.canonical_status ?? ""),
      String(rec.amount ?? ""),
      String(rec.description ?? ""),
      String(rec.type ?? ""),
      String(rec.cliente_nome ?? ""),
      maskDocumentoForCsv(rec.cliente_documento ? String(rec.cliente_documento) : null),
      String(rec.boleto_barcode ?? ""),
      String(rec.numero_nfse ?? ""),
      String(rec.gateway_transaction_id ?? "")
    ]);
  }
}
