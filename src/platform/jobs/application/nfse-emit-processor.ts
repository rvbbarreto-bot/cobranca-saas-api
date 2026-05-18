import { UnrecoverableError } from "bullmq";
import type { PoolClient } from "pg";
import { writeAuditLog } from "../../audit/audit.service";
import { decrypt } from "../../crypto/decrypt";
import type { EmitirNfseInput } from "../../../modules/nfse/domain/nfse-gateway.interface";
import { NfseError } from "../../../modules/nfse/domain/nfse-error";
import {
  FocusNFeAdapter,
  mapRegimeTributarioToFocus
} from "../../../modules/nfse/infrastructure/focus-nfe/focus-nfe-adapter";
import { enqueueNotificationJob } from "../enqueue-notification";
import { withTenantTransaction } from "../../persistence/with-tenant-transaction";

export type NfseEmitJobData = {
  chargeId: string;
  tenantId: string;
};

type EmitContextRow = {
  charge_id: string;
  tenant_id: string;
  amount: string;
  reference: string;
  canonical_status: string;
  cliente_nome: string;
  cliente_documento: string;
  cliente_email: string;
  cliente_telefone: string | null;
  cnpj_emissor: string | null;
  inscricao_municipal: string | null;
  regime_tributario: string | null;
  codigo_municipio: string | null;
  aliquota_iss: string | null;
  focus_nfe_token_encrypted: string | null;
  encryption_iv: string | null;
};

export type NfseEmitProcessorDeps = {
  withTenant?: typeof withTenantTransaction;
  createAdapter?: (token: string) => FocusNFeAdapter;
};

async function loadExistingNfse(
  client: PoolClient,
  chargeId: string
): Promise<{ status: string } | null> {
  const r = await client.query<{ status: string }>(
    `SELECT status FROM nfse_emissions WHERE charge_id = $1::uuid LIMIT 1`,
    [chargeId]
  );
  return r.rows[0] ?? null;
}

async function loadEmitContext(
  client: PoolClient,
  chargeId: string,
  tenantId: string
): Promise<EmitContextRow | null> {
  const r = await client.query<EmitContextRow>(
    `SELECT
       c.id::text AS charge_id,
       c.tenant_id::text AS tenant_id,
       c.amount::text AS amount,
       c.reference,
       c.canonical_status,
       cli.nome AS cliente_nome,
       cli.documento AS cliente_documento,
       cli.email AS cliente_email,
       cli.telefone AS cliente_telefone,
       ec.cnpj_emissor,
       ec.inscricao_municipal,
       ec.regime_tributario,
       ec.codigo_municipio,
       ec.aliquota_iss::text AS aliquota_iss,
       ec.focus_nfe_token_encrypted,
       ec.encryption_iv
     FROM charges c
     INNER JOIN portal.cliente cli
       ON cli.id = COALESCE(
         c.customer_id,
         (NULLIF(c.metadata->>'portal_cliente_id', ''))::uuid
       )
       AND cli.tenant_id = COALESCE(
         NULLIF(c.metadata->>'portal_automacao_tenant_id', ''),
         c.tenant_id::text
       )
     INNER JOIN escritorio_config ec ON ec.tenant_id = c.tenant_id::text
     WHERE c.id = $1::uuid
       AND c.tenant_id = $2::uuid
       AND c.canonical_status = 'paga'
     LIMIT 1`,
    [chargeId, tenantId]
  );
  return r.rows[0] ?? null;
}

function buildEmitPayload(row: EmitContextRow): EmitirNfseInput {
  const cnpj = (row.cnpj_emissor ?? "").replace(/\D/g, "");
  const codigoMunicipio = (row.codigo_municipio ?? "").replace(/\D/g, "");
  const doc = row.cliente_documento.replace(/\D/g, "");
  return {
    referencia: row.charge_id,
    dataEmissao: new Date().toISOString(),
    prestador: {
      cnpj,
      inscricaoMunicipal: row.inscricao_municipal ?? "",
      codigoMunicipio,
      regimeTributario: mapRegimeTributarioToFocus(row.regime_tributario)
    },
    tomador: {
      cpfCnpj: doc,
      razaoSocial: row.cliente_nome,
      email: row.cliente_email,
      telefone: row.cliente_telefone?.replace(/\D/g, "") ?? undefined
    },
    servico: {
      valor: Number(row.amount),
      issRetido: false,
      itemListaServico: "01.07",
      discriminacao: row.reference,
      codigoMunicipio,
      aliquota: row.aliquota_iss ? Number(row.aliquota_iss) : undefined
    }
  };
}

export async function processNfseEmit(
  data: NfseEmitJobData,
  deps: NfseEmitProcessorDeps = {}
): Promise<void> {
  const withTenant = deps.withTenant ?? withTenantTransaction;
  const createAdapter = deps.createAdapter ?? ((token: string) => new FocusNFeAdapter(token));

  await withTenant(data.tenantId, async (client) => {
    const existing = await loadExistingNfse(client, data.chargeId);
    if (existing && (existing.status === "autorizado" || existing.status === "emitindo")) {
      return;
    }

    const ctx = await loadEmitContext(client, data.chargeId, data.tenantId);
    if (!ctx) {
      throw new UnrecoverableError("charge_not_found_or_not_paid");
    }

    if (!ctx.focus_nfe_token_encrypted || !ctx.encryption_iv) {
      throw new UnrecoverableError("focus_nfe_token_not_configured");
    }

    const focusToken = decrypt(ctx.focus_nfe_token_encrypted, ctx.encryption_iv);
    const adapter = createAdapter(focusToken);
    const payload = buildEmitPayload(ctx);

    await client.query(
      `INSERT INTO nfse_emissions (tenant_id, charge_id, provider, external_ref, status)
       VALUES ($1, $2::uuid, 'focus_nfe', $3, 'emitindo')
       ON CONFLICT (charge_id) DO UPDATE
         SET status = 'emitindo', error_message = NULL`,
      [data.tenantId, data.chargeId, data.chargeId]
    );

    try {
      const result = await adapter.emitir(payload);
      await client.query(
        `UPDATE nfse_emissions SET
           status = 'autorizado',
           numero_nfse = $2,
           codigo_verificacao = $3,
           pdf_url = $4,
           xml_url = $5,
           emitted_at = $6,
           error_message = NULL
         WHERE charge_id = $1::uuid`,
        [
          data.chargeId,
          result.numeroNfse,
          result.codigoVerificacao,
          result.pdfUrl,
          result.xmlUrl,
          result.emitidoEm
        ]
      );

      await writeAuditLog(
        {
          tenantId: data.tenantId,
          action: "create",
          resourceType: "nfse_emission",
          resourceId: data.chargeId,
          newValue: {
            charge_id: data.chargeId,
            numero_nfse: result.numeroNfse,
            status: "autorizado"
          }
        },
        client
      );

      await enqueueNotificationJob(
        {
          chargeId: data.chargeId,
          tenantId: data.tenantId,
          eventType: "nfse_emitida"
        },
        { jobName: "nfse-emitida", jobId: `nfse-notif-${data.chargeId}` }
      );
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      await client.query(
        `UPDATE nfse_emissions SET status = 'erro', error_message = $2 WHERE charge_id = $1::uuid`,
        [data.chargeId, msg]
      );

      if (error instanceof NfseError && error.unrecoverable) {
        throw new UnrecoverableError(msg);
      }
      throw error;
    }
  });
}
