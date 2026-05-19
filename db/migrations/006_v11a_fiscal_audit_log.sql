-- V11A: log de auditoria fiscal (gate + envio + resposta) — PostgreSQL
-- Pré-requisito: 005_corretora_seguros_fiscal.sql aplicada (tenant_segment, etc.)

-- ---------------------------------------------------------------------------
-- Ampliar segmentos: serviço de TI (flexível / validado no n8n)
-- ---------------------------------------------------------------------------
ALTER TABLE automacao.tenants DROP CONSTRAINT IF EXISTS chk_automacao_tenants_tenant_segment;

ALTER TABLE automacao.tenants
  ADD CONSTRAINT chk_automacao_tenants_tenant_segment
  CHECK (tenant_segment IN ('generico', 'corretora_seguros', 'servico_ti'));

COMMENT ON COLUMN automacao.tenants.tenant_segment IS
  'generico | corretora_seguros | servico_ti — regras do gate V11A no workflow.';

-- ---------------------------------------------------------------------------
-- Tabela de auditoria (100% tentativas com ref após Preparar Ref NF)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS automacao.fiscal_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  tenant_segment TEXT,
  ref_nf TEXT NOT NULL,
  status TEXT NOT NULL,
  motivo_bloqueio TEXT,
  payload_envio JSONB,
  payload_resposta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE automacao.fiscal_audit_log
  DROP CONSTRAINT IF EXISTS uq_fiscal_audit_log_ref_nf;

ALTER TABLE automacao.fiscal_audit_log
  ADD CONSTRAINT uq_fiscal_audit_log_ref_nf UNIQUE (ref_nf);

CREATE INDEX IF NOT EXISTS idx_fiscal_audit_log_tenant_created
  ON automacao.fiscal_audit_log (tenant_id, created_at DESC);

COMMENT ON TABLE automacao.fiscal_audit_log IS
  'V11A: auditoria gate + payload enviado à Focus + resposta; uma linha por ref_nf.';

COMMENT ON COLUMN automacao.fiscal_audit_log.status IS
  'bloqueado_gate | gate_aprovado | payload_registrado | emitido_erro | emitido_sucesso — evoluir conforme workflow.';
