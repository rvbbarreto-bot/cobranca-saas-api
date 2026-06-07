-- Sprint 2 — EXEQ-FISC-020: Certificate Vault dedicado
-- ADR: docs/ADR_SERPRO_FISCAL_MVP.md (D4)
-- Anti-regressão: somente CREATE em fiscal; não altera certificado_digital legado.

CREATE TABLE IF NOT EXISTS fiscal.certificate_vault (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         UUID NOT NULL REFERENCES portal.organization (id) ON DELETE CASCADE,
  automacao_tenant_id     TEXT NOT NULL,
  portal_cliente_id       UUID REFERENCES portal.cliente (id) ON DELETE SET NULL,
  owner_type              TEXT NOT NULL DEFAULT 'empresa'
    CHECK (owner_type IN ('empresa', 'escritorio', 'exeq')),
  label                   TEXT NOT NULL,
  cert_encrypted          TEXT NOT NULL,
  key_encrypted           TEXT NOT NULL,
  encryption_iv           TEXT NOT NULL,
  valid_from              DATE NOT NULL,
  valid_until             DATE NOT NULL,
  rotation_of             UUID REFERENCES fiscal.certificate_vault (id) ON DELETE SET NULL,
  status                  TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'expiring', 'revoked', 'expired')),
  legacy_certificado_id   UUID,
  uploaded_by_user_id     UUID REFERENCES portal.app_user (id) ON DELETE SET NULL,
  metadata                JSONB NOT NULL DEFAULT '{}',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_certificate_vault_label_len CHECK (char_length(trim(label)) BETWEEN 1 AND 120)
);

CREATE INDEX IF NOT EXISTS idx_certificate_vault_org
  ON fiscal.certificate_vault (organization_id);

CREATE INDEX IF NOT EXISTS idx_certificate_vault_tenant_cliente
  ON fiscal.certificate_vault (automacao_tenant_id, portal_cliente_id)
  WHERE portal_cliente_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_certificate_vault_valid_until
  ON fiscal.certificate_vault (valid_until)
  WHERE status IN ('active', 'expiring');

CREATE INDEX IF NOT EXISTS idx_certificate_vault_status
  ON fiscal.certificate_vault (status);

CREATE UNIQUE INDEX IF NOT EXISTS uq_certificate_vault_legacy_certificado
  ON fiscal.certificate_vault (legacy_certificado_id)
  WHERE legacy_certificado_id IS NOT NULL;

COMMENT ON TABLE fiscal.certificate_vault IS
  'Vault A1/A3 cifrado (AES-256-GCM). Substitui fiscal.certificado_digital como fonte primária.';
