-- Sprint 4 — EXEQ-FISC-050: processamento fiscal rastreável + timeline
-- ADR: docs/ADR_SERPRO_FISCAL_MVP.md (D6)

CREATE TABLE IF NOT EXISTS fiscal.processamento_fiscal (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         UUID NOT NULL REFERENCES portal.organization (id) ON DELETE CASCADE,
  automacao_tenant_id     TEXT NOT NULL,
  portal_cliente_id       UUID NOT NULL REFERENCES portal.cliente (id) ON DELETE RESTRICT,
  fiscal_ingest_id        UUID REFERENCES fiscal.fiscal_ingest (id) ON DELETE SET NULL,
  competencia             TEXT NOT NULL,
  tipo                    TEXT NOT NULL DEFAULT 'PGDASD_APURACAO'
    CHECK (tipo IN ('PGDASD_APURACAO')),
  status                  TEXT NOT NULL DEFAULT 'VALIDADO'
    CHECK (status IN (
      'RASCUNHO', 'VALIDANDO', 'VALIDADO', 'TRANSMITINDO',
      'TRANSMITIDA', 'RECIBO_OK', 'EMITINDO_DAS', 'CONCLUIDO', 'ERRO'
    )),
  valor_apurado           NUMERIC(15, 2),
  protocolo_serpro        TEXT,
  recibo_storage_key      TEXT,
  guia_fiscal_id          UUID,
  erro_codigo             TEXT,
  erro_detalhe            JSONB,
  idempotency_key         TEXT NOT NULL UNIQUE,
  correlation_id          TEXT,
  canonical_snapshot      JSONB NOT NULL DEFAULT '{}',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_processamento_fiscal_tenant
  ON fiscal.processamento_fiscal (automacao_tenant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_processamento_fiscal_cliente
  ON fiscal.processamento_fiscal (portal_cliente_id, competencia);

CREATE INDEX IF NOT EXISTS idx_processamento_fiscal_status
  ON fiscal.processamento_fiscal (status);

CREATE TABLE IF NOT EXISTS fiscal.processamento_evento (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processamento_id    UUID NOT NULL REFERENCES fiscal.processamento_fiscal (id) ON DELETE CASCADE,
  evento              TEXT NOT NULL,
  payload             JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_processamento_evento_proc
  ON fiscal.processamento_evento (processamento_id, created_at);

COMMENT ON TABLE fiscal.processamento_fiscal IS
  'Pipeline PGDASD: ingest validado → transmissão SERPRO → recibo → DAS.';

COMMENT ON TABLE fiscal.processamento_evento IS
  'Timeline auditável do processamento fiscal.';
