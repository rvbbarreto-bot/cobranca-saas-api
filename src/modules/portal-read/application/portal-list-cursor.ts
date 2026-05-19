import { z } from "zod";

const chargeCursorSchema = z.object({
  k: z.literal("chg"),
  v: z.literal(1),
  ca: z.string().min(1),
  id: z.string().uuid()
});

const clienteCursorSchema = z.object({
  k: z.literal("cli"),
  v: z.literal(1),
  nome: z.string(),
  id: z.string().uuid()
});

const nfCursorSchema = z.object({
  k: z.literal("nf"),
  v: z.literal(1),
  /** ISO ou null quando created_at da NF for nulo */
  ca: z.string().nullable(),
  id: z.string().regex(/^\d+$/)
});

export type ChargeListCursor = z.infer<typeof chargeCursorSchema>;
export type ClienteListCursor = z.infer<typeof clienteCursorSchema>;
export type NfListCursor = z.infer<typeof nfCursorSchema>;

export function parsePortalListLimit(raw: unknown, defaultLimit = 50): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 1) {
    return defaultLimit;
  }
  return Math.min(n, 200);
}

export function encodePortalCursor(payload: unknown): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodePortalCursor<T>(raw: string | undefined): T | null {
  if (!raw || typeof raw !== "string" || !raw.trim()) {
    return null;
  }
  try {
    const json = Buffer.from(raw.trim(), "base64url").toString("utf8");
    const data = JSON.parse(json) as T;
    return data ?? null;
  } catch {
    return null;
  }
}

export function parseChargeListCursor(raw: string | undefined): ChargeListCursor | "invalid" | null {
  if (!raw || typeof raw !== "string" || !raw.trim()) {
    return null;
  }
  const d = decodePortalCursor<unknown>(raw);
  if (d === null) {
    return "invalid";
  }
  const p = chargeCursorSchema.safeParse(d);
  return p.success ? p.data : "invalid";
}

export function parseClienteListCursor(raw: string | undefined): ClienteListCursor | "invalid" | null {
  if (!raw || typeof raw !== "string" || !raw.trim()) {
    return null;
  }
  const d = decodePortalCursor<unknown>(raw);
  if (d === null) {
    return "invalid";
  }
  const p = clienteCursorSchema.safeParse(d);
  return p.success ? p.data : "invalid";
}

export function parseNfListCursor(raw: string | undefined): NfListCursor | "invalid" | null {
  if (!raw || typeof raw !== "string" || !raw.trim()) {
    return null;
  }
  const d = decodePortalCursor<unknown>(raw);
  if (d === null) {
    return "invalid";
  }
  const p = nfCursorSchema.safeParse(d);
  return p.success ? p.data : "invalid";
}

export function chargeCursorFromCharge(row: { createdAt: string; id: string }): string {
  return encodePortalCursor({
    k: "chg",
    v: 1,
    ca: row.createdAt,
    id: row.id
  } satisfies ChargeListCursor);
}

export function clienteCursorFromRow(row: { nome: string; id: string }): string {
  return encodePortalCursor({
    k: "cli",
    v: 1,
    nome: row.nome,
    id: row.id
  } satisfies ClienteListCursor);
}

/** Cursor a partir de uma linha da view `portal.vw_notas_fiscais_resumo` (requer coluna `id`). */
export function nfCursorFromNotaRow(row: { id: string | null; created_at: Date | string | null }): string | null {
  const id = typeof row.id === "string" ? row.id.trim() : "";
  if (!/^\d+$/.test(id)) {
    return null;
  }
  const ca =
    row.created_at instanceof Date
      ? row.created_at.toISOString()
      : row.created_at
        ? String(row.created_at)
        : null;
  return encodePortalCursor({
    k: "nf",
    v: 1,
    ca,
    id
  } satisfies NfListCursor);
}
