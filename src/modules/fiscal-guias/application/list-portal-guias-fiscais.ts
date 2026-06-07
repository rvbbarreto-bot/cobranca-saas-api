import {
  guiaFiscalCursorFromRow,
  mapGuiaFiscalRowToResponse,
  parseGuiaFiscalListCursor
} from "./map-guia-fiscal-row";
import {
  listGuiasFiscaisByTenantPage,
  type GuiaFiscalKeysetCursor,
  type ListGuiasFiscaisFilter
} from "../infrastructure/guia-fiscal-repository";
import { listGuiasFiscaisQuerySchema } from "../domain/schemas/guia-fiscal.schema";

export type ListPortalGuiasFiscaisInput = {
  tenantId: string;
  query: Record<string, unknown>;
};

export type ListPortalGuiasFiscaisResult =
  | {
      ok: true;
      guias: ReturnType<typeof mapGuiaFiscalRowToResponse>[];
      count: number;
      page_limit: number;
      next_cursor: string | null;
    }
  | { ok: false; kind: "invalid_cursor" }
  | { ok: false; kind: "validation"; issues: { path: string; message: string }[] };

export async function listPortalGuiasFiscaisUseCase(
  input: ListPortalGuiasFiscaisInput
): Promise<ListPortalGuiasFiscaisResult> {
  const parsedQuery = listGuiasFiscaisQuerySchema.safeParse(input.query);
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
  const cursorRaw = typeof input.query.cursor === "string" ? input.query.cursor : undefined;
  const parsedCursor = parseGuiaFiscalListCursor(cursorRaw);
  if (parsedCursor === "invalid") {
    return { ok: false, kind: "invalid_cursor" };
  }

  const keyset: GuiaFiscalKeysetCursor | null = parsedCursor
    ? { createdAtIso: parsedCursor.ca, id: parsedCursor.id }
    : null;

  const filter: ListGuiasFiscaisFilter = {};
  if (q.status) filter.status = q.status;
  if (q.tipo_guia) filter.tipo_guia = q.tipo_guia;
  if (q.portal_cliente_id) filter.portal_cliente_id = q.portal_cliente_id;
  if (q.competencia) filter.competencia = q.competencia;

  const { items, has_more } = await listGuiasFiscaisByTenantPage(input.tenantId, {
    limit: q.limit,
    cursor: keyset,
    filter
  });

  const guias = items.map(mapGuiaFiscalRowToResponse);
  const last = items[items.length - 1];
  const next_cursor = has_more && last ? guiaFiscalCursorFromRow(last) : null;

  return {
    ok: true,
    guias,
    count: guias.length,
    page_limit: q.limit,
    next_cursor
  };
}
