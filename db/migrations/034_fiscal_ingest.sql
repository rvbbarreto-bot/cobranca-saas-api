-- Sprint 3 — EXEQ-FISC-032: ingestão CSV PGDASD (status + payload validado)
-- ADR: docs/ADR_SERPRO_FISCAL_MVP.md (D5, D6 parcial)

CREATE TABLE IF NOT EXISTS fiscal.fiscal_ingest (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         UUID NOT NULL REFERENCES portal.organization (id) ON DELETE CASCADE,
  automacao_tenant_id     TEXT NOT NULL,
  uploaded_by_user_id     UUID REFERENCES portal.app_user (id) ON DELETE SET NULL,
  source_type             TEXT NOT NULL DEFAULT 'csv'
    CHECK (source_type IN ('csv', 'excel', 'api')),
  status                  TEXT NOT NULL DEFAULT 'VALIDANDO'
    CHECK (status IN ('VALIDANDO', 'VALIDADO', 'ERRO')),
  original_filename       TEXT,
  raw_content             TEXT NOT NULL,
  row_count               INT NOT NULL DEFAULT 0,
  valid_count             INT NOT NULL DEFAULT 0,
  error_count             INT NOT NULL DEFAULT 0,
  validation_errors       JSONB NOT NULL DEFAULT '[]',
  canonical_rows          JSONB NOT NULL DEFAULT '[]',
  metadata                JSONB NOT NULL DEFAULT '{}',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fiscal_ingest_tenant
  ON fiscal.fiscal_ingest (automacao_tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fiscal_ingest_org
  ON fiscal.fiscal_ingest (organization_id);

CREATE INDEX IF NOT EXISTS idx_fiscal_ingest_status
  ON fiscal.fiscal_ingest (status);

COMMENT ON TABLE fiscal.fiscal_ingest IS
  'Upload CSV PGDASD — pipeline assíncrono VALIDANDO → VALIDADO|ERRO.';
