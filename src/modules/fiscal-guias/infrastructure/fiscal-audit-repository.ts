import type { Pool } from "pg";
import type { FiscalAuditAction } from "./fiscal-audit.service";

export type FiscalAuditLogRow = {
  id: string;
  tenantId: string;
  userId: string | null;
  action: FiscalAuditAction;
  resourceType: string;
  resourceId: string;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
};

export type FiscalAuditListFilter = {
  from?: Date;
  to?: Date;
  action?: FiscalAuditAction;
  userId?: string;
};

export type FiscalAuditKeysetCursor = {
  createdAtIso: string;
  id: string;
};

function mapRow(row: {
  id: string;
  tenant_id: string;
  user_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string;
  old_value: unknown;
  new_value: unknown;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
}): FiscalAuditLogRow {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    userId: row.user_id,
    action: row.action as FiscalAuditAction,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    oldValue: (row.old_value as Record<string, unknown> | null) ?? null,
    newValue: (row.new_value as Record<string, unknown> | null) ?? null,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    createdAt: row.created_at
  };
}

export function fiscalAuditCursorFromRow(row: FiscalAuditLogRow): string {
  const payload = {
    ca: row.createdAt.toISOString(),
    id: row.id
  };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export type FiscalAuditParsedCursor = { ca: string; id: string };

export function parseFiscalAuditListCursor(
  raw: string | undefined
): FiscalAuditParsedCursor | null | "invalid" {
  if (!raw?.trim()) {
    return null;
  }
  try {
    const json = Buffer.from(raw.trim(), "base64url").toString("utf8");
    const parsed = JSON.parse(json) as { ca?: unknown; id?: unknown };
    if (typeof parsed.ca !== "string" || typeof parsed.id !== "string" || !parsed.id.trim()) {
      return "invalid";
    }
    return { ca: parsed.ca, id: parsed.id };
  } catch {
    return "invalid";
  }
}

export async function listFiscalAuditByTenantPage(
  pool: Pool,
  tenantId: string,
  input: {
    limit: number;
    cursor: FiscalAuditKeysetCursor | null;
    filter: FiscalAuditListFilter;
  }
): Promise<{ items: FiscalAuditLogRow[]; has_more: boolean }> {
  const params: unknown[] = [tenantId];
  const where: string[] = ["tenant_id = $1"];

  if (input.filter.from) {
    params.push(input.filter.from.toISOString());
    where.push(`created_at >= $${params.length}::timestamptz`);
  }
  if (input.filter.to) {
    params.push(input.filter.to.toISOString());
    where.push(`created_at <= $${params.length}::timestamptz`);
  }
  if (input.filter.action) {
    params.push(input.filter.action);
    where.push(`action = $${params.length}`);
  }
  if (input.filter.userId?.trim()) {
    params.push(`%${input.filter.userId.trim()}%`);
    where.push(`user_id ILIKE $${params.length}`);
  }

  if (input.cursor) {
    params.push(input.cursor.createdAtIso, input.cursor.id);
    const caIdx = params.length - 1;
    const idIdx = params.length;
    where.push(
      `(created_at, id) < ($${caIdx}::timestamptz, $${idIdx}::uuid)`
    );
  }

  params.push(input.limit + 1);
  const limitIdx = params.length;

  const sql = `
    SELECT id::text, tenant_id, user_id, action, resource_type, resource_id,
           old_value, new_value, ip_address, user_agent, created_at
    FROM fiscal.audit_log
    WHERE ${where.join(" AND ")}
    ORDER BY created_at DESC, id DESC
    LIMIT $${limitIdx}`;

  const r = await pool.query(sql, params);
  const rows = r.rows.map(mapRow);
  const has_more = rows.length > input.limit;
  const items = has_more ? rows.slice(0, input.limit) : rows;
  return { items, has_more };
}
