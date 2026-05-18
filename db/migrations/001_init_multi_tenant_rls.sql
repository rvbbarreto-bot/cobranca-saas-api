-- Multi-tenant base + RLS (PostgreSQL)
-- Executar com usuario que a aplicacao usara em producao (ou ajustar GRANTs).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Tenants
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'trial')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO tenants (id, slug, name, status)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'demo',
  'Tenant Demo',
  'active'
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO tenants (id, slug, name, status)
VALUES (
  '00000000-0000-4000-8000-000000000002',
  'other',
  'Tenant Other (testes)',
  'active'
)
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Cobrancas (billing-core)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  reference TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  due_date DATE NOT NULL,
  canonical_status TEXT NOT NULL DEFAULT 'emitida'
    CHECK (canonical_status IN ('rascunho', 'emitida', 'enviada', 'pendente_pagamento', 'paga', 'vencida', 'cancelada', 'erro_emissao')),
  provider TEXT,
  provider_charge_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT charges_tenant_reference_unique UNIQUE (tenant_id, reference),
  CONSTRAINT charges_tenant_idempotency_unique UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_charges_tenant_status ON charges (tenant_id, canonical_status);
CREATE INDEX IF NOT EXISTS idx_charges_tenant_due ON charges (tenant_id, due_date);

-- ---------------------------------------------------------------------------
-- Webhook inbox (n8n / provedores)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS webhook_inbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'n8n',
  external_event_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}',
  correlation_id TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT webhook_inbox_dedup UNIQUE (tenant_id, external_event_id)
);

CREATE INDEX IF NOT EXISTS idx_webhook_inbox_tenant_created ON webhook_inbox (tenant_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- tenants: sem RLS (catalogo pequeno; resolucao slug/uuid ocorre antes de set_config)
-- ---------------------------------------------------------------------------
ALTER TABLE charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE charges FORCE ROW LEVEL SECURITY;
ALTER TABLE webhook_inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_inbox FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS charges_tenant_isolation ON charges;
CREATE POLICY charges_tenant_isolation ON charges
  FOR ALL
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS webhook_inbox_tenant_isolation ON webhook_inbox;
CREATE POLICY webhook_inbox_tenant_isolation ON webhook_inbox
  FOR ALL
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

-- Permissoes para role de aplicacao (opcional: criar role dedicada em producao)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO saas_app;
