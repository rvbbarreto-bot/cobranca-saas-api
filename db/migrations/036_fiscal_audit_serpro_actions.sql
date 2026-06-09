-- Sprint 5 — novas ações audit fiscal (certificado expirando, procuração SERPRO)

ALTER TABLE fiscal.audit_log DROP CONSTRAINT IF EXISTS audit_log_action_check;
ALTER TABLE fiscal.audit_log ADD CONSTRAINT audit_log_action_check CHECK (action IN (
  'download_pdf',
  'consulta_guia',
  'status_change',
  'upload_certificado',
  'admin_access',
  'guia_disponibilizada',
  'compliance_bloqueio',
  'capture_requested',
  'capture_failed',
  'certificado_expirando',
  'procuracao_validada_serpro'
));
