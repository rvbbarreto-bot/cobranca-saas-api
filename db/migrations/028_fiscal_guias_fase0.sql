-- Fase 0 — Módulo fiscal guias (DAS/DARF)
-- ADR: docs/ADR_FISCAL_GUIAS_FASE0.md
--
-- REGRAS ANTI-REGRESSÃO:
--   • Somente CREATE SCHEMA / CREATE TABLE / CREATE INDEX neste arquivo.
--   • NÃO altera public.*, portal.*, automacao.* (homologação cobrança + NFS-e legado).
--   • tenant_id TEXT alinha a portal.cliente.tenant_id (automacao.tenants).

CREATE SCHEMA IF NOT EXISTS fiscal;

COMMENT ON SCHEMA fiscal IS
  'Guias fiscais DAS/DARF — domínio Exeq; separado de automacao.fiscal_audit_log (NFS-e legado).';

-- ---------------------------------------------------------------------------
-- Certificado digital A1 (por empresa/cliente portal)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fiscal.certificado_digital (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           TEXT NOT NULL,
  portal_cliente_id   UUID NOT NULL REFERENCES portal.cliente (id) ON DELETE RESTRICT,
  label               TEXT NOT NULL,
  valid_from          DATE NOT NULL,
  valid_until         DATE NOT NULL,
  cert_encrypted      TEXT NOT NULL,
  key_encrypted       TEXT NOT NULL,
  encryption_iv       TEXT NOT NULL,
  uploaded_by_user_id UUID REFERENCES portal.app_user (id) ON DELETE SET NULL,
  ativo               BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_certificado_validade CHECK (valid_until >= valid_from),
  CONSTRAINT chk_certificado_label_len CHECK (char_length(trim(label)) BETWEEN 1 AND 80)
);

CREATE INDEX IF NOT EXISTS idx_fiscal_certificado_tenant_cliente
  ON fiscal.certificado_digital (tenant_id, portal_cliente_id);

CREATE INDEX IF NOT EXISTS idx_fiscal_certificado_validade
  ON fiscal.certificado_digital (tenant_id, valid_until DESC)
  WHERE ativo = true;

COMMENT ON TABLE fiscal.certificado_digital IS
  'Certificados A1 cifrados (AES-256-GCM via ENCRYPTION_KEY da aplicação).';

-- ---------------------------------------------------------------------------
-- Procuração (e-CAC / Receita)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fiscal.procuracao (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             TEXT NOT NULL,
  portal_cliente_id     UUID NOT NULL REFERENCES portal.cliente (id) ON DELETE RESTRICT,
  tipo                  TEXT NOT NULL DEFAULT 'ecac'
    CHECK (tipo IN ('ecac', 'receita_federal', 'outro')),
  procurador_documento  TEXT NOT NULL,
  validade_inicio       DATE NOT NULL,
  validade_fim          DATE NOT NULL,
  ativa                 BOOLEAN NOT NULL DEFAULT true,
  metadata              JSONB NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_procuracao_documento_len CHECK (char_length(procurador_documento) IN (11, 14)),
  CONSTRAINT chk_procuracao_validade CHECK (validade_fim >= validade_inicio)
);

CREATE INDEX IF NOT EXISTS idx_fiscal_procuracao_tenant_cliente
  ON fiscal.procuracao (tenant_id, portal_cliente_id);

COMMENT ON TABLE fiscal.procuracao IS
  'Procurações digitais por empresa (portal.cliente / CNPJ).';

-- ---------------------------------------------------------------------------
-- Guia fiscal (DAS / DARF)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fiscal.guia_fiscal (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           TEXT NOT NULL,
  portal_cliente_id   UUID NOT NULL REFERENCES portal.cliente (id) ON DELETE RESTRICT,
  tipo_guia           TEXT NOT NULL CHECK (tipo_guia IN ('DAS', 'DARF')),
  competencia         TEXT NOT NULL CHECK (competencia ~ '^\d{4}-\d{2}$'),
  data_vencimento     DATE,
  valor_principal     NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (valor_principal >= 0),
  valor_multa         NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (valor_multa >= 0),
  valor_juros         NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (valor_juros >= 0),
  valor_total         NUMERIC(14, 2) GENERATED ALWAYS AS (
    COALESCE(valor_principal, 0) + COALESCE(valor_multa, 0) + COALESCE(valor_juros, 0)
  ) STORED,
  linha_digitavel     TEXT,
  pix_copia_cola      TEXT,
  status              TEXT NOT NULL DEFAULT 'PROCESSANDO'
    CHECK (status IN (
      'PROCESSANDO',
      'DISPONIVEL',
      'PAGO',
      'CANCELADO',
      'RETIFICADO',
      'VENCIDO',
      'EM_CONTESTACAO'
    )),
  compliance_status   TEXT NOT NULL DEFAULT 'pendente'
    CHECK (compliance_status IN ('pendente', 'aprovado', 'bloqueado', 'dispensado')),
  compliance_motivo   TEXT,
  pdf_url             TEXT,
  pdf_storage_key     TEXT,
  versao_atual        INT NOT NULL DEFAULT 1 CHECK (versao_atual >= 1),
  idempotency_key     TEXT NOT NULL,
  capture_job_id      TEXT,
  metadata            JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_guia_fiscal_idempotency UNIQUE (tenant_id, idempotency_key),
  CONSTRAINT uq_guia_fiscal_competencia_versao UNIQUE (
    tenant_id, portal_cliente_id, tipo_guia, competencia, versao_atual
  )
);

CREATE INDEX IF NOT EXISTS idx_guia_fiscal_tenant_status
  ON fiscal.guia_fiscal (tenant_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_guia_fiscal_tenant_cliente_comp
  ON fiscal.guia_fiscal (tenant_id, portal_cliente_id, competencia DESC);

CREATE INDEX IF NOT EXISTS idx_guia_fiscal_tenant_vencimento
  ON fiscal.guia_fiscal (tenant_id, data_vencimento)
  WHERE status IN ('DISPONIVEL', 'VENCIDO');

COMMENT ON TABLE fiscal.guia_fiscal IS
  'Guias DAS/DARF por empresa (portal.cliente) e competência.';

COMMENT ON COLUMN fiscal.guia_fiscal.competencia IS
  'Período de apuração YYYY-MM (ex.: DAS Simples Nacional).';

-- ---------------------------------------------------------------------------
-- Versões / retificações
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fiscal.guia_fiscal_versao (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guia_fiscal_id  UUID NOT NULL REFERENCES fiscal.guia_fiscal (id) ON DELETE CASCADE,
  versao_numero   INT NOT NULL CHECK (versao_numero >= 1),
  motivo          TEXT NOT NULL CHECK (motivo IN ('retificacao', 'correcao_sistema', 'contestacao')),
  snapshot        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_guia_fiscal_versao UNIQUE (guia_fiscal_id, versao_numero)
);

CREATE INDEX IF NOT EXISTS idx_guia_fiscal_versao_guia
  ON fiscal.guia_fiscal_versao (guia_fiscal_id, versao_numero DESC);

-- ---------------------------------------------------------------------------
-- Pagamento da guia (domínio fiscal — não confundir com public.charges)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fiscal.guia_pagamento (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guia_fiscal_id   UUID NOT NULL REFERENCES fiscal.guia_fiscal (id) ON DELETE CASCADE,
  tenant_id        TEXT NOT NULL,
  valor_pago       NUMERIC(14, 2) NOT NULL CHECK (valor_pago > 0),
  data_pagamento   DATE NOT NULL,
  meio             TEXT NOT NULL DEFAULT 'manual'
    CHECK (meio IN ('pix', 'boleto', 'manual', 'conciliacao')),
  comprovante_url  TEXT,
  metadata         JSONB NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_guia_pagamento_guia
  ON fiscal.guia_pagamento (guia_fiscal_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Auditoria fiscal (não altera public.audit_log homologado)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS fiscal.audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     TEXT NOT NULL,
  user_id       TEXT,
  action        TEXT NOT NULL CHECK (action IN (
    'download_pdf',
    'consulta_guia',
    'status_change',
    'upload_certificado',
    'admin_access',
    'guia_disponibilizada',
    'compliance_bloqueio',
    'capture_requested',
    'capture_failed'
  )),
  resource_type TEXT NOT NULL,
  resource_id   TEXT NOT NULL,
  old_value     JSONB,
  new_value     JSONB,
  ip_address    TEXT,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fiscal_audit_tenant_resource
  ON fiscal.audit_log (tenant_id, resource_type, resource_id);

CREATE INDEX IF NOT EXISTS idx_fiscal_audit_tenant_date
  ON fiscal.audit_log (tenant_id, created_at DESC);

COMMENT ON TABLE fiscal.audit_log IS
  'Auditoria do módulo guias fiscais; separada de public.audit_log (cobrança).';
