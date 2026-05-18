-- Sprint 2: comunicacao, templates e regua de cobranca.

-- 1. communication_events: historico de cada mensagem enviada
CREATE TABLE IF NOT EXISTS communication_events (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           TEXT NOT NULL,
  charge_id           UUID REFERENCES charges (id),
  channel             TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp', 'sms')),
  event_type          TEXT NOT NULL,
  recipient           TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'delivered', 'cancelled')),
  provider_message_id TEXT,
  error_message       TEXT,
  attempts            INT NOT NULL DEFAULT 0,
  sent_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comm_tenant ON communication_events (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_comm_charge ON communication_events (charge_id);

-- 2. notification_templates: templates editaveis por tenant
CREATE TABLE IF NOT EXISTS notification_templates (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      TEXT,
  event_type     TEXT NOT NULL,
  channel        TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp')),
  subject        TEXT,
  body_template  TEXT NOT NULL,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_template UNIQUE NULLS NOT DISTINCT (tenant_id, event_type, channel)
);

-- 3. charging_rules: regua de cobranca configuravel por tenant
CREATE TABLE IF NOT EXISTS charging_rules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   TEXT NOT NULL,
  days_offset INT NOT NULL,
  channel     TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp', 'both')),
  template_id UUID REFERENCES notification_templates (id),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_rule UNIQUE (tenant_id, days_offset, channel)
);

CREATE INDEX IF NOT EXISTS idx_rules_tenant ON charging_rules (tenant_id, is_active);

-- 4. Seed: templates padrao do sistema (tenant_id IS NULL)
INSERT INTO notification_templates (tenant_id, event_type, channel, subject, body_template)
VALUES
  (NULL, 'lembrete_pre_3d', 'whatsapp', NULL,
   'Olá {{nome}}, seu boleto de {{valor}} vence em 3 dias ({{data_vencimento}}). Pague com PIX: {{link_pix}}'),
  (NULL, 'lembrete_pre_1d', 'whatsapp', NULL,
   'Último lembrete: seu boleto de {{valor}} vence amanhã ({{data_vencimento}}). PIX: {{link_pix}}'),
  (NULL, 'vencimento_hoje', 'email', '[Aviso] Boleto vencendo hoje — {{escritorio_nome}}',
   'Olá {{nome}}, seu boleto de {{valor}} vence hoje. Multa de {{multa_percentual}}% aplicada após hoje.'),
  (NULL, 'pos_vencimento_3d', 'whatsapp', NULL,
   'Boleto vencido há 3 dias. Regularize agora: {{link_boleto}}'),
  (NULL, 'pos_vencimento_7d', 'email', '[Último Aviso] Pendência — {{escritorio_nome}}',
   'Olá {{nome}}, você possui um boleto vencido há 7 dias no valor de {{valor}}. Regularize em 48h para evitar negativação.'),
  (NULL, 'pagamento_confirmado', 'email', 'Pagamento confirmado — {{escritorio_nome}}',
   'Olá {{nome}}, seu pagamento de {{valor}} foi confirmado em {{data_pagamento}}. Obrigado!')
ON CONFLICT (tenant_id, event_type, channel) DO NOTHING;
