import type { Pool } from "pg";
import {
  type FiscalAuditLogResponse,
  listFiscalAuditQuerySchema
} from "../domain/schemas/fiscal-audit.schema";
import {
  fiscalAuditCursorFromRow,
  listFiscalAuditByTenantPage,
  parseFiscalAuditListCursor,
  type FiscalAuditLogRow
} from "../infrastructure/fiscal-audit-repository";

export type ListPortalFiscalAuditResult =
  | {
      ok: true;
      entries: FiscalAuditLogResponse[];
      count: number;
      page_limit: number;
      next_cursor: string | null;
    }
  | { ok: false; kind: "invalid_cursor" }
  | { ok: false; kind: "validation"; issues: { path: string; message: string }[] };

function startOfDayUtc(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

function endOfDayUtc(isoDate: string): Date {
  return new Date(`${isoDate}T23:59:59.999Z`);
}

function mapPublic(row: FiscalAuditLogRow): FiscalAuditLogResponse {
  return {
    id: row.id,
    user_id: row.userId,
    action: row.action,
    resource_type: row.resourceType,
    resource_id: row.resourceId,
    old_value: row.oldValue,
    new_value: row.newValue,
    ip_address: row.ipAddress,
    created_at: row.createdAt.toISOString()
  };
}

export async function listPortalFiscalAuditUseCase(
  pool: Pool,
  tenantId: string,
  rawQuery: Record<string, unknown>
): Promise<ListPortalFiscalAuditResult> {
  const parsedQuery = listFiscalAuditQuerySchema.safeParse(rawQuery);
  if (!parsedQuery.success) {
    return {
      ok: false,
      kind: "validation",
      issues: parsedQuery.error.issues.map((i) => ({
        path: i.path.join(".") || "query",
        message: i.message
      }))
    };
  }

  const q = parsedQuery.data;
  const cursorRaw = typeof rawQuery.cursor === "string" ? rawQuery.cursor : undefined;
  const parsedCursor = parseFiscalAuditListCursor(cursorRaw);
  if (parsedCursor === "invalid") {
    return { ok: false, kind: "invalid_cursor" };
  }

  const { items, has_more } = await listFiscalAuditByTenantPage(pool, tenantId, {
    limit: q.limit,
    cursor: parsedCursor ? { createdAtIso: parsedCursor.ca, id: parsedCursor.id } : null,
    filter: {
      from: q.from ? startOfDayUtc(q.from) : undefined,
      to: q.to ? endOfDayUtc(q.to) : undefined,
      action: q.action,
      userId: q.user_id
    }
  });

  const entries = items.map(mapPublic);
  const last = items[items.length - 1];
  const next_cursor = has_more && last ? fiscalAuditCursorFromRow(last) : null;

  return {
    ok: true,
    entries,
    count: entries.length,
    page_limit: q.limit,
    next_cursor
  };
}
