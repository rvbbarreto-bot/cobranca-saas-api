-- Campos de política fiscal (motor RTC / legado) em automacao.tenants
-- Pré-requisito: tabela automacao.tenants já existir no mesmo banco usado pelo n8n.

ALTER TABLE automacao.tenants
  ADD COLUMN IF NOT EXISTS fiscal_engine_enabled BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE automacao.tenants
  ADD COLUMN IF NOT EXISTS fiscal_force_legacy_only BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE automacao.tenants
  ADD COLUMN IF NOT EXISTS rtc_declarative_effective_from DATE NULL;

ALTER TABLE automacao.tenants
  ADD COLUMN IF NOT EXISTS rtc_cbs_rate TEXT NULL;

ALTER TABLE automacao.tenants
  ADD COLUMN IF NOT EXISTS rtc_ibs_rate TEXT NULL;

COMMENT ON COLUMN automacao.tenants.fiscal_engine_enabled IS 'Liga o motor fiscal no fluxo; ainda pode permanecer legado se force_legacy ou competência anterior.';
COMMENT ON COLUMN automacao.tenants.fiscal_force_legacy_only IS 'Kill-switch: força estratégia legacy_nfse_nacional independente da data.';
COMMENT ON COLUMN automacao.tenants.rtc_declarative_effective_from IS 'Data YYYY-MM-DD a partir da qual a intenção RTC pode ser avaliada (conforme política).';
COMMENT ON COLUMN automacao.tenants.rtc_cbs_rate IS 'Alíquota CBS decimal string ex.: 0.009';
COMMENT ON COLUMN automacao.tenants.rtc_ibs_rate IS 'Alíquota IBS decimal string ex.: 0.001';
