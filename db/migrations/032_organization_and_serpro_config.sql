-- Sprint 1 — EXEQ-FISC-010/012: organização multi-tenant + config SERPRO
-- ADR: docs/ADR_SERPRO_FISCAL_MVP.md
-- Anti-regressão: somente CREATE em portal/fiscal; não altera public.* legado.

CREATE TABLE IF NOT EXISTS portal.organization (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                TEXT NOT NULL,
  name                TEXT NOT NULL,
  type                TEXT NOT NULL DEFAULT 'escritorio'
    CHECK (type IN ('exeq', 'escritorio', 'bpo', 'franqueado', 'parceiro')),
  parent_organization_id UUID REFERENCES portal.organization (id) ON DELETE SET NULL,
  status              TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('trial', 'active', 'suspended')),
  metadata            JSONB NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_organization_slug UNIQUE (slug),
  CONSTRAINT chk_organization_name_len CHECK (char_length(trim(name)) BETWEEN 1 AND 200)
);

CREATE INDEX IF NOT EXISTS idx_organization_type ON portal.organization (type);
CREATE INDEX IF NOT EXISTS idx_organization_parent ON portal.organization (parent_organization_id)
  WHERE parent_organization_id IS NOT NULL;

COMMENT ON TABLE portal.organization IS
  'Eixo organizacional escalável (Exeq, escritório, BPO, franqueado).';

CREATE TABLE IF NOT EXISTS portal.organization_tenant (
  organization_id     UUID PRIMARY KEY REFERENCES portal.organization (id) ON DELETE CASCADE,
  automacao_tenant_id TEXT NOT NULL UNIQUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_organization_tenant_automacao
  ON portal.organization_tenant (automacao_tenant_id);

COMMENT ON TABLE portal.organization_tenant IS
  'Vínculo 1:1 org ↔ automacao.tenants.id (escritório).';

-- Config SERPRO por organização (credenciais cifradas)
CREATE TABLE IF NOT EXISTS fiscal.serpro_config (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id         UUID NOT NULL UNIQUE REFERENCES portal.organization (id) ON DELETE CASCADE,
  ambiente                TEXT NOT NULL DEFAULT 'demo'
    CHECK (ambiente IN ('demo', 'prod')),
  contratante_cnpj        TEXT NOT NULL,
  consumer_key_encrypted  TEXT,
  consumer_secret_encrypted TEXT,
  encryption_iv           TEXT NOT NULL,
  serpro_enabled          BOOLEAN NOT NULL DEFAULT false,
  metadata                JSONB NOT NULL DEFAULT '{}',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_serpro_contratante_cnpj CHECK (char_length(contratante_cnpj) = 14)
);

CREATE INDEX IF NOT EXISTS idx_serpro_config_org ON fiscal.serpro_config (organization_id);

COMMENT ON TABLE fiscal.serpro_config IS
  'Integração SERPRO Integra Contador — credenciais AES-256-GCM (ENCRYPTION_KEY).';
