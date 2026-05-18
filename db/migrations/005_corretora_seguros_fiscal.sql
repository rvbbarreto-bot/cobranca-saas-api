-- Segmento corretora de seguros + trilha fiscal persistida na NF (V11 workflow).
-- Executar no mesmo PostgreSQL onde existem automacao.tenants e automacao.notas_fiscais.

-- ---------------------------------------------------------------------------
-- Tenant: políticas multi-corretora (defaults preservam comportamento V10)
-- ---------------------------------------------------------------------------
ALTER TABLE automacao.tenants
  ADD COLUMN IF NOT EXISTS tenant_segment TEXT NOT NULL DEFAULT 'generico';

ALTER TABLE automacao.tenants
  ADD COLUMN IF NOT EXISTS fiscal_corretora_strict BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE automacao.tenants
  ADD COLUMN IF NOT EXISTS fiscal_allow_municipio_tomador_fallback BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE automacao.tenants
  ADD COLUMN IF NOT EXISTS fiscal_corretora_codigo_nbs_padrao TEXT NULL;

ALTER TABLE automacao.tenants
  ADD COLUMN IF NOT EXISTS fiscal_corretora_perfil_padrao TEXT NOT NULL DEFAULT 'livre';

COMMENT ON COLUMN automacao.tenants.tenant_segment IS
  'generico | corretora_seguros — ativa regras e gate fiscal do workflow V11.';

COMMENT ON COLUMN automacao.tenants.fiscal_corretora_strict IS
  'Se true e segmento corretora: exige município do tomador com endereço; valida perfil CPF/CNPJ.';

COMMENT ON COLUMN automacao.tenants.fiscal_allow_municipio_tomador_fallback IS
  'Se false: não replica codigo_municipio_prestacao como tomador (reduz risco fiscal).';

COMMENT ON COLUMN automacao.tenants.fiscal_corretora_codigo_nbs_padrao IS
  'NBS padrão da corretora quando o canal não informar (parametrizado pelo contador).';

COMMENT ON COLUMN automacao.tenants.fiscal_corretora_perfil_padrao IS
  'livre | segurado | seguradora — dica de validação no gate (não substitui parecer contábil).';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_automacao_tenants_tenant_segment'
  ) THEN
    ALTER TABLE automacao.tenants
      ADD CONSTRAINT chk_automacao_tenants_tenant_segment
      CHECK (tenant_segment IN ('generico', 'corretora_seguros'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_automacao_tenants_corretora_perfil'
  ) THEN
    ALTER TABLE automacao.tenants
      ADD CONSTRAINT chk_automacao_tenants_corretora_perfil
      CHECK (fiscal_corretora_perfil_padrao IN ('livre', 'segurado', 'seguradora'));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Nota: pacote de auditoria fiscal (preenchido após pré-validador no n8n V11)
-- ---------------------------------------------------------------------------
ALTER TABLE automacao.notas_fiscais
  ADD COLUMN IF NOT EXISTS fiscal_audit_package JSONB NULL;

COMMENT ON COLUMN automacao.notas_fiscais.fiscal_audit_package IS
  'Snapshot: modo RTC, fallback, trilha, resumo payload — gravado no fluxo V11 após pré-validação.';
