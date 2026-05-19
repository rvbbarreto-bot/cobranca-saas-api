import { z } from "zod";
import type { PoolClient } from "pg";
import type { AuditRequestContext } from "../../../platform/audit/audit-context";
import { writeAuditLog } from "../../../platform/audit/audit.service";
import { cancelReguaJobsForCharge } from "../../../platform/jobs/enqueue-notification";
import { getPool } from "../../../platform/persistence/pool";

const postRuleSchema = z.object({
  days_offset: z.number().int().min(-30).max(30),
  channel: z.enum(["email", "whatsapp", "both"]),
  template_id: z.string().uuid().optional()
});

const patchRuleSchema = z.object({
  is_active: z.boolean().optional(),
  channel: z.enum(["email", "whatsapp", "both"]).optional()
});

export async function listChargingRules(client: PoolClient, tenantId: string) {
  const r = await client.query(
    `SELECT cr.id::text, cr.days_offset, cr.channel, cr.is_active,
            nt.event_type, left(nt.body_template, 80) AS body_preview
     FROM charging_rules cr
     LEFT JOIN notification_templates nt ON nt.id = cr.template_id
     WHERE cr.tenant_id = $1
     ORDER BY cr.days_offset ASC`,
    [tenantId]
  );
  return r.rows;
}

export async function createChargingRule(
  client: PoolClient,
  tenantId: string,
  raw: unknown,
  audit?: AuditRequestContext
) {
  const parsed = postRuleSchema.safeParse(raw);
  if (!parsed.success) {
    const err = new Error("VALIDATION_ERROR");
    (err as Error & { issues: unknown }).issues = parsed.error.issues;
    throw err;
  }
  try {
    const r = await client.query(
      `INSERT INTO charging_rules (tenant_id, days_offset, channel, template_id)
       VALUES ($1, $2, $3, $4::uuid)
       RETURNING id::text, days_offset, channel, is_active`,
      [tenantId, parsed.data.days_offset, parsed.data.channel, parsed.data.template_id ?? null]
    );
    const row = r.rows[0];
    if (audit && row) {
      await writeAuditLog(
        {
          tenantId,
          userId: audit.userId,
          action: "create",
          resourceType: "charging_rule",
          resourceId: String(row.id),
          newValue: row as Record<string, unknown>,
          ipAddress: audit.ipAddress,
          userAgent: audit.userAgent
        },
        client
      );
    }
    return row;
  } catch (error: unknown) {
    const pg = error as { code?: string };
    if (pg.code === "23505") {
      throw new Error("DUPLICATE_RULE");
    }
    throw error;
  }
}

export async function patchChargingRule(
  client: PoolClient,
  tenantId: string,
  ruleId: string,
  raw: unknown,
  audit?: AuditRequestContext
) {
  const parsed = patchRuleSchema.safeParse(raw);
  if (!parsed.success) {
    const err = new Error("VALIDATION_ERROR");
    (err as Error & { issues: unknown }).issues = parsed.error.issues;
    throw err;
  }
  const sets: string[] = [];
  const vals: unknown[] = [tenantId, ruleId];
  let p = 3;
  if (parsed.data.is_active !== undefined) {
    sets.push(`is_active = $${p++}`);
    vals.push(parsed.data.is_active);
  }
  if (parsed.data.channel !== undefined) {
    sets.push(`channel = $${p++}`);
    vals.push(parsed.data.channel);
  }
  if (sets.length === 0) {
    throw new Error("VALIDATION_ERROR");
  }
  sets.push("updated_at = now()");
  const r = await client.query(
    `UPDATE charging_rules SET ${sets.join(", ")}
     WHERE tenant_id = $1 AND id = $2::uuid
     RETURNING id::text, days_offset, channel, is_active`,
    vals
  );
  const row = r.rows[0];
  if (!row) {
    throw new Error("NOT_FOUND");
  }
  if (audit) {
    await writeAuditLog(
      {
        tenantId,
        userId: audit.userId,
        action: "update",
        resourceType: "charging_rule",
        resourceId: ruleId,
        newValue: row as Record<string, unknown>,
        ipAddress: audit.ipAddress,
        userAgent: audit.userAgent
      },
      client
    );
  }
  return row;
}

export async function deleteChargingRule(
  client: PoolClient,
  tenantId: string,
  ruleId: string,
  audit?: AuditRequestContext
) {
  const r = await client.query(
    `DELETE FROM charging_rules WHERE tenant_id = $1 AND id = $2::uuid RETURNING id::text`,
    [tenantId, ruleId]
  );
  if (!r.rows[0]) {
    throw new Error("NOT_FOUND");
  }

  const pool = getPool();
  const charges = await pool.query<{ id: string }>(
    `SELECT id::text FROM charges WHERE tenant_id = $1::uuid`,
    [tenantId]
  );
  for (const ch of charges.rows) {
    await cancelReguaJobsForCharge(ch.id);
  }

  if (audit) {
    await writeAuditLog(
      {
        tenantId,
        userId: audit.userId,
        action: "delete",
        resourceType: "charging_rule",
        resourceId: ruleId,
        ipAddress: audit.ipAddress,
        userAgent: audit.userAgent
      },
      client
    );
  }
}
