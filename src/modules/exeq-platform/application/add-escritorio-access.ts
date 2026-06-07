import type { Pool } from "pg";
import { DatabaseError } from "pg";
import { hashPortalPassword } from "../../portal-read/application/portal-password";

export type AddEscritorioAccessInput = {
  email: string;
  fullName: string;
  password: string;
  role: "admin_escritorio" | "operador";
};

export function parseAddEscritorioAccessBody(body: unknown):
  | { ok: true; value: AddEscritorioAccessInput }
  | { ok: false; message: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, message: "Body JSON obrigatorio." };
  }
  const o = body as Record<string, unknown>;
  const email = typeof o.email === "string" ? o.email.trim() : "";
  const fullName =
    typeof o.full_name === "string"
      ? o.full_name.trim()
      : typeof o.fullName === "string"
        ? o.fullName.trim()
        : "";
  const password = typeof o.password === "string" ? o.password : "";
  const roleRaw = typeof o.role === "string" ? o.role.trim() : "admin_escritorio";
  const role = roleRaw === "operador" || roleRaw === "admin_escritorio" ? roleRaw : null;

  if (!email || !email.includes("@")) {
    return { ok: false, message: "email obrigatorio." };
  }
  if (!fullName) {
    return { ok: false, message: "full_name obrigatorio." };
  }
  if (!password || password.length < 8) {
    return { ok: false, message: "password obrigatorio (min 8 caracteres)." };
  }
  if (!role) {
    return { ok: false, message: "role deve ser admin_escritorio ou operador." };
  }

  return { ok: true, value: { email, fullName, password, role } };
}

export async function addEscritorioAccess(
  pool: Pool,
  automacaoTenantId: string,
  input: AddEscritorioAccessInput
): Promise<{ appUserId: string; membershipId: string }> {
  const exists = await pool.query(`SELECT 1 FROM automacao.tenants WHERE id::text = $1 LIMIT 1`, [
    automacaoTenantId
  ]);
  if (!exists.rows[0]) {
    throw new EscritorioAccessNotFoundError();
  }

  const passwordHash = await hashPortalPassword(input.password);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const ins = await client.query<{ id: string }>(
      `INSERT INTO portal.app_user (email, full_name, password_hash)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE
         SET full_name = EXCLUDED.full_name,
             password_hash = EXCLUDED.password_hash,
             updated_at = now()
       RETURNING id::text AS id`,
      [input.email, input.fullName, passwordHash]
    );
    const appUserId = ins.rows[0]?.id;
    if (!appUserId) {
      throw new Error("Falha ao upsert portal.app_user.");
    }

    await client.query(
      `DELETE FROM portal.membership
       WHERE app_user_id = $1::uuid
         AND tenant_id = $2
         AND role IN ('admin_escritorio', 'operador')`,
      [appUserId, automacaoTenantId]
    );

    const mem = await client.query<{ id: string }>(
      `INSERT INTO portal.membership (app_user_id, tenant_id, role)
       VALUES ($1::uuid, $2, $3)
       RETURNING id::text AS id`,
      [appUserId, automacaoTenantId, input.role]
    );
    const membershipId = mem.rows[0]?.id;
    if (!membershipId) {
      throw new Error("Falha ao criar membership.");
    }

    await client.query("COMMIT");
    return { appUserId, membershipId };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export class EscritorioAccessNotFoundError extends Error {
  constructor() {
    super("Escritorio nao encontrado.");
    this.name = "EscritorioAccessNotFoundError";
  }
}
