export function mapCertificadoRowToResponse(row: {
  id: string;
  portal_cliente_id: string;
  label: string;
  valid_from: string;
  valid_until: string;
  ativo: boolean;
  certificate_vault_id?: string | null;
  created_at: Date;
  updated_at: Date;
}) {
  return {
    id: row.id,
    certificate_vault_id: row.certificate_vault_id ?? row.id,
    portal_cliente_id: row.portal_cliente_id,
    label: row.label,
    valid_from: row.valid_from,
    valid_until: row.valid_until,
    ativo: row.ativo,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString()
  };
}
