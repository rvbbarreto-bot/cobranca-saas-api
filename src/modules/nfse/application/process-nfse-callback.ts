import type { PoolClient } from "pg";
import { writeAuditLog } from "../../../platform/audit/audit.service";
import { enqueueNotificationJob } from "../../../platform/jobs/enqueue-notification";

export type NfseCallbackBody = {
  referencia: string;
  cnpj_prestador?: string;
  status: "autorizado" | "erro" | "cancelado" | string;
  numero_nfse?: string;
  codigo_verificacao?: string;
  pdf_url?: string;
  xml_url?: string;
  mensagem_erro?: string;
};

export async function processNfseCallback(
  client: PoolClient,
  body: NfseCallbackBody
): Promise<{ tenantId: string; chargeId: string; applied: boolean }> {
  const r = await client.query<{
    tenant_id: string;
    charge_id: string;
    status: string;
  }>(
    `SELECT tenant_id, charge_id::text AS charge_id, status
     FROM nfse_emissions
     WHERE external_ref = $1 OR charge_id::text = $1
     LIMIT 1`,
    [body.referencia]
  );
  const row = r.rows[0];
  if (!row) {
    throw new Error("NFSE_NOT_FOUND");
  }

  if (row.status === "autorizado" && body.status === "autorizado") {
    return { tenantId: row.tenant_id, chargeId: row.charge_id, applied: false };
  }

  const mappedStatus =
    body.status === "autorizado" || body.status === "erro" || body.status === "cancelado"
      ? body.status
      : "erro";

  await client.query(
    `UPDATE nfse_emissions SET
       status = $2,
       numero_nfse = COALESCE($3, numero_nfse),
       codigo_verificacao = COALESCE($4, codigo_verificacao),
       pdf_url = COALESCE($5, pdf_url),
       xml_url = COALESCE($6, xml_url),
       emitted_at = CASE WHEN $2 = 'autorizado' THEN now() ELSE emitted_at END,
       error_message = $7
     WHERE charge_id = $1::uuid`,
    [
      row.charge_id,
      mappedStatus,
      body.numero_nfse ?? null,
      body.codigo_verificacao ?? null,
      body.pdf_url ?? null,
      body.xml_url ?? null,
      body.mensagem_erro ?? null
    ]
  );

  await writeAuditLog(
    {
      tenantId: row.tenant_id,
      action: "update",
      resourceType: "nfse_emission",
      resourceId: row.charge_id,
      newValue: { status: mappedStatus, source: "focus_callback" }
    },
    client
  );

  if (mappedStatus === "autorizado") {
    await enqueueNotificationJob(
      {
        chargeId: row.charge_id,
        tenantId: row.tenant_id,
        eventType: "nfse_emitida"
      },
      { jobName: "nfse-emitida", jobId: `nfse-notif-${row.charge_id}` }
    );
  }

  return { tenantId: row.tenant_id, chargeId: row.charge_id, applied: true };
}
