-- Sprint 4 — Catálogo de planos SaaS + assinatura por tenant + uso mensal (metering)

CREATE TABLE IF NOT EXISTS planos (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome              TEXT NOT NULL,
  slug              TEXT NOT NULL UNIQUE,
  max_clientes      INT NOT NULL CHECK (max_clientes > 0),
  max_cobrancas_mes INT NOT NULL CHECK (max_cobrancas_mes > 0),
  preco_mensal      NUMERIC(10, 2) NOT NULL CHECK (preco_mensal >= 0),
  features          JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assinaturas (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID NOT NULL UNIQUE REFERENCES tenants (id) ON DELETE CASCADE,
  plano_id                UUID NOT NULL REFERENCES planos (id),
  status                  TEXT NOT NULL DEFAULT 'trial'
    CHECK (status IN ('trial', 'active', 'past_due', 'suspended', 'canceled')),
  trial_ends_at           TIMESTAMPTZ,
  current_period_start    TIMESTAMPTZ,
  current_period_end      TIMESTAMPTZ,
  gateway_subscription_id TEXT,
  read_only               BOOLEAN NOT NULL DEFAULT false,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assinaturas_plano ON assinaturas (plano_id);
CREATE INDEX IF NOT EXISTS idx_assinaturas_status ON assinaturas (status);

CREATE TABLE IF NOT EXISTS tenant_usage_monthly (
  tenant_id         UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  year_month        TEXT NOT NULL CHECK (year_month ~ '^\d{4}-\d{2}$'),
  cobrancas_criadas INT NOT NULL DEFAULT 0 CHECK (cobrancas_criadas >= 0),
  PRIMARY KEY (tenant_id, year_month)
);

INSERT INTO planos (nome, slug, max_clientes, max_cobrancas_mes, preco_mensal, features)
VALUES
  (
    'Básico',
    'basico',
    50,
    200,
    99.00,
    '{"tier":"basico","suporte":"email"}'::jsonb
  ),
  (
    'Profissional',
    'profissional',
    250,
    2000,
    299.00,
    '{"tier":"profissional","suporte":"email_whatsapp"}'::jsonb
  ),
  (
    'Enterprise',
    'enterprise',
    5000,
    50000,
    999.00,
    '{"tier":"enterprise","suporte":"dedicado"}'::jsonb
  )
ON CONFLICT (slug) DO NOTHING;

-- Demo tenant: assinatura trial no plano profissional (idempotente)
INSERT INTO assinaturas (tenant_id, plano_id, status, trial_ends_at, current_period_start, current_period_end)
SELECT
  t.id,
  p.id,
  'trial',
  now() + interval '14 days',
  now(),
  now() + interval '14 days'
FROM tenants t
CROSS JOIN planos p
WHERE t.slug = 'demo'
  AND p.slug = 'profissional'
ON CONFLICT (tenant_id) DO NOTHING;
