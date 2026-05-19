import type { Pool } from "pg";

export type ProvisionPublicTenantInput = {
  slug: string;
  name: string;
  status: "active" | "suspended" | "trial";
  automacaoTenantId?: string | null;
};

export type ProvisionPublicTenantResult = {
  publicTenantId: string;
  slug: string;
  name: string;
  billingLinked: boolean;
};

function isValidTenantSlug(slug: string): boolean {
  if (slug.length < 2 || slug.length > 64) {
    return false;
  }
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

export function parseProvisionPublicTenantBody(body: unknown):
  | { ok: true; value: ProvisionPublicTenantInput }
  | { ok: false; message: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, message: "Body JSON obrigatorio." };
  }
  const o = body as Record<string, unknown>;
  const slug = typeof o.slug === "string" ? o.slug.trim().toLowerCase() : "";
  const name = typeof o.name === "string" ? o.name.trim() : "";
  const statusRaw = typeof o.status === "string" ? o.status.trim().toLowerCase() : "trial";
  const automacaoTenantId =
    typeof o.automacao_tenant_id === "string"
      ? o.automacao_tenant_id.trim()
      : typeof o.automacaoTenantId === "string"
        ? o.automacaoTenantId.trim()
        : "";

  if (!slug || !isValidTenantSlug(slug)) {
    return {
      ok: false,
      message: "slug invalido: 2-64 caracteres, minusculas, digitos e hifens entre segmentos (ex.: escritorio-alpha)."
    };
  }
  if (!name || name.length > 200) {
    return { ok: false, message: "name obrigatorio (max 200 caracteres)." };
  }
  const status =
    statusRaw === "active" || statusRaw === "suspended" || statusRaw === "trial" ? statusRaw : null;
  if (!status) {
    return { ok: false, message: "status deve ser trial, active ou suspended." };
  }

  return {
    ok: true,
    value: {
      slug,
      name,
      status,
      automacaoTenantId: automacaoTenantId || undefined
    }
  };
}

export async function provisionPublicTenant(
  pool: Pool,
  input: ProvisionPublicTenantInput
): Promise<ProvisionPublicTenantResult> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const ins = await client.query<{ id: string; slug: string; name: string }>(
      `INSERT INTO tenants (slug, name, status) VALUES ($1, $2, $3) RETURNING id::text AS id, slug, name`,
      [input.slug, input.name, input.status]
    );
    const row = ins.rows[0];
    if (!row) {
      throw new Error("INSERT tenants sem retorno.");
    }

    let billingLinked = false;
    if (input.automacaoTenantId) {
      await client.query(
        `INSERT INTO portal.billing_tenant_link (automacao_tenant_id, public_tenant_id)
         VALUES ($1, $2::uuid)
         ON CONFLICT (automacao_tenant_id) DO UPDATE
           SET public_tenant_id = EXCLUDED.public_tenant_id`,
        [input.automacaoTenantId, row.id]
      );
      billingLinked = true;
    }

    await client.query("COMMIT");
    return {
      publicTenantId: row.id,
      slug: row.slug,
      name: row.name,
      billingLinked
    };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
