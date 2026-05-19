import { createHash, randomBytes } from "node:crypto";
import type { PoolClient } from "pg";
import { writeAuditLog } from "../../../platform/audit/audit.service";
import type { AuditRequestContext } from "../../../platform/audit/audit-context";
import { enqueueNotificationJob } from "../../../platform/jobs/enqueue-notification";

export type ClienteMagicLinkRow = {
  id: string;
  tenant_id: string;
  cliente_id: string;
};

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function findClienteByEmailForAutomacaoTenant(
  client: PoolClient,
  email: string,
  automacaoTenantId: string
): Promise<{ id: string; email: string; nome: string } | null> {
  const r = await client.query<{ id: string; email: string; nome: string }>(
    `SELECT id::text AS id, email, nome
     FROM portal.cliente
     WHERE lower(email) = lower($1) AND tenant_id = $2
     LIMIT 1`,
    [email.trim(), automacaoTenantId]
  );
  return r.rows[0] ?? null;
}

export async function requestClienteMagicLink(
  client: PoolClient,
  input: {
    email: string;
    automacaoTenantId: string;
    tenantSlug: string;
    escritorioNome?: string;
  },
  audit?: AuditRequestContext
): Promise<{ enqueued: boolean }> {
  const cliente = await findClienteByEmailForAutomacaoTenant(
    client,
    input.email,
    input.automacaoTenantId
  );
  if (!cliente?.email) {
    return { enqueued: false };
  }

  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);

  await client.query(
    `INSERT INTO cliente_access_tokens (tenant_id, cliente_id, token_hash, expires_at)
     VALUES ($1, $2::uuid, $3, now() + interval '15 minutes')`,
    [input.automacaoTenantId, cliente.id, tokenHash]
  );

  await writeAuditLog(
    {
      tenantId: input.automacaoTenantId,
      action: "create",
      resourceType: "cliente_access_token",
      resourceId: cliente.id,
      newValue: { cliente_id: cliente.id },
      userId: audit?.userId,
      ipAddress: audit?.ipAddress,
      userAgent: audit?.userAgent
    },
    client
  );

  await enqueueNotificationJob(
    {
      tenantId: input.automacaoTenantId,
      eventType: "magic_link",
      forceChannel: "email",
      metadata: {
        token,
        clienteId: cliente.id,
        email: cliente.email,
        tenant_slug: input.tenantSlug,
        escritorio_nome: input.escritorioNome ?? "Escritório"
      }
    },
    { jobName: "magic-link", jobId: `magic-link-${cliente.id}-${Date.now()}` }
  );

  return { enqueued: true };
}

export async function verifyClienteMagicLinkToken(
  client: PoolClient,
  token: string,
  automacaoTenantId: string,
  audit?: AuditRequestContext
): Promise<{ clienteId: string } | null> {
  const tokenHash = hashToken(token.trim());
  const r = await client.query<ClienteMagicLinkRow>(
    `SELECT id::text AS id, tenant_id, cliente_id::text AS cliente_id
     FROM cliente_access_tokens
     WHERE token_hash = $1
       AND tenant_id = $2
       AND expires_at > now()
       AND used_at IS NULL
     LIMIT 1
     FOR UPDATE`,
    [tokenHash, automacaoTenantId]
  );
  const row = r.rows[0];
  if (!row) {
    return null;
  }

  await client.query(`UPDATE cliente_access_tokens SET used_at = now() WHERE id = $1::uuid`, [
    row.id
  ]);

  await writeAuditLog(
    {
      tenantId: automacaoTenantId,
      action: "update",
      resourceType: "cliente_access_token",
      resourceId: row.id,
      newValue: { used: true, cliente_id: row.cliente_id },
      userId: audit?.userId,
      ipAddress: audit?.ipAddress,
      userAgent: audit?.userAgent
    },
    client
  );

  return { clienteId: row.cliente_id };
}
