-- TAREFA 0.2: schema proprio para NFS-e e config do escritorio (desacoplamento de automacao).

CREATE TABLE IF NOT EXISTS nfse_emissions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           TEXT NOT NULL,
  charge_id           UUID NOT NULL REFERENCES charges(id),
  provider            TEXT NOT NULL DEFAULT 'focus_nfe',
  external_ref        TEXT,
  numero_nfse         TEXT,
  codigo_verificacao  TEXT,
  pdf_url             TEXT,
  xml_url             TEXT,
  status              TEXT NOT NULL DEFAULT 'pendente'
                      CHECK (status IN ('pendente','emitindo','autorizado','erro','cancelado')),
  emitted_at          TIMESTAMPTZ,
  error_message       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_nfse_charge UNIQUE (charge_id)
);

CREATE INDEX IF NOT EXISTS idx_nfse_tenant ON nfse_emissions(tenant_id, status);

CREATE TABLE IF NOT EXISTS escritorio_config (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                   TEXT NOT NULL UNIQUE,
  cnpj_emissor                TEXT,
  razao_social                TEXT,
  inscricao_municipal         TEXT,
  regime_tributario           TEXT CHECK (regime_tributario IN ('simples','presumido','real')),
  codigo_municipio            TEXT,
  aliquota_iss                NUMERIC(5,2),
  gateway_provider            TEXT DEFAULT 'asaas'
                              CHECK (gateway_provider IN ('asaas','pagarme')),
  gateway_api_key_encrypted   TEXT,
  focus_nfe_token_encrypted   TEXT,
  whatsapp_provider           TEXT DEFAULT 'zapi',
  whatsapp_token_encrypted    TEXT,
  encryption_iv               TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);
