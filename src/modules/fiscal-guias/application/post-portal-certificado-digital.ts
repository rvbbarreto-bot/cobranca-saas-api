import type { PoolClient } from "pg";
import { withTenantTransaction } from "../../../platform/persistence/with-tenant-transaction";
import { parsePostCertificadoDigitalBody } from "../domain/schemas/certificado-digital.schema";
import { writeFiscalAuditLog } from "../infrastructure/fiscal-audit.service";
import { mapCertificadoRowToResponse } from "./map-certificado-row";
import {
  insertCertificadoDigital,
  portalClienteBelongsToTenant
} from "../infrastructure/certificado-digital-repository";

export async function postPortalCertificadoDigitalUseCase(input: {
  tenantId: string;
  body: unknown;
  uploadedByUserId?: string;
}): Promise<
  | { ok: true; certificado: ReturnType<typeof mapCertificadoRowToResponse> }
  | { ok: false; kind: "validation_error"; issues: import("zod").ZodIssue[] }
  | { ok: false; kind: "cliente_not_found" }
> {
  const parsed = parsePostCertificadoDigitalBody(input.body);
  if (!parsed.ok) {
    return { ok: false, kind: "validation_error", issues: parsed.issues };
  }

  const belongs = await portalClienteBelongsToTenant(
    input.tenantId,
    parsed.value.portal_cliente_id
  );
  if (!belongs) {
    return { ok: false, kind: "cliente_not_found" };
  }

  const row = await withTenantTransaction(input.tenantId, async (client: PoolClient) => {
    const cert = await insertCertificadoDigital(client, {
      tenantId: input.tenantId,
      portalClienteId: parsed.value.portal_cliente_id,
      label: parsed.value.label,
      validFrom: parsed.value.valid_from,
      validUntil: parsed.value.valid_until,
      certificadoPem: parsed.value.certificado_pem,
      chavePrivadaPem: parsed.value.chave_privada_pem,
      uploadedByUserId: input.uploadedByUserId
    });

    await writeFiscalAuditLog(
      {
        tenantId: input.tenantId,
        userId: input.uploadedByUserId,
        action: "upload_certificado",
        resourceType: "certificate_vault",
        resourceId: cert.certificate_vault_id ?? cert.id,
        newValue: {
          portal_cliente_id: parsed.value.portal_cliente_id,
          label: parsed.value.label,
          valid_until: parsed.value.valid_until
        }
      },
      client
    );

    return cert;
  });

  return { ok: true, certificado: mapCertificadoRowToResponse(row) };
}
