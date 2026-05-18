-- Sprint 2: comunicacao, templates, regua de cobranca + timestamps de cobranca.

ALTER TABLE charges
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

ALTER TABLE charges
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS communication_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  charge_id UUID REFERENCES charges (id) ON DELETE SET NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp', 'sms')),
  event_type TEXT NOT NULL,
  recipient TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'delivered', 'cancelled')),
  provider_message_id TEXT,
  error_message TEXT,
  attempts INT NOT NULL DEFAULT 0,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comm_tenant_status ON communication_events (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_comm_charge ON communication_events (charge_id);
CREATE INDEX IF NOT EXISTS idx_comm_charge_event ON communication_events (charge_id, event_type, created_at DESC);

CREATE TABLE IF NOT EXISTS notification_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT,
  event_type TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp')),
  subject TEXT,
  body_template TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_templates_tenant_event_channel
  ON notification_templates (COALESCE(tenant_id, ''), event_type, channel);

CREATE TABLE IF NOT EXISTS charging_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  days_offset INT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp', 'both')),
  template_id UUID REFERENCES notification_templates (id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_charging_rule UNIQUE (tenant_id, days_offset, channel)
);

CREATE INDEX IF NOT EXISTS idx_charging_rules_tenant_active ON charging_rules (tenant_id, is_active);

-- Templates padrao do sistema (tenant_id NULL = read-only no portal)
INSERT INTO notification_templates (tenant_id, event_type, channel, subject, body_template)
SELECT v.tenant_id, v.event_type, v.channel, v.subject, v.body_template
FROM (
  VALUES
    (NULL::text, 'lembrete_pre_3d', 'whatsapp', NULL::text,
     'Ola {{nome}}, seu boleto de {{valor}} vence em 3 dias ({{data_vencimento}}). Pague com PIX: {{link_pix}}'),
    (NULL, 'lembrete_pre_1d', 'whatsapp', NULL,
     'Ultimo lembrete: boleto vence amanha. PIX: {{link_pix}}'),
    (NULL, 'vencimento_hoje', 'email', '[Aviso] Boleto vence hoje',
     'Seu boleto de {{valor}} venceu hoje. Multa de {{multa_percentual}}% pode ser aplicada.'),
    (NULL, 'pos_vencimento_3d', 'whatsapp', NULL,
     'Boleto vencido ha 3 dias. Regularize: {{link_boleto}}'),
    (NULL, 'pos_vencimento_7d', 'email', 'Ultimo aviso',
     'Ultimo aviso. Regularize em 48h para evitar negativacao.'),
    (NULL, 'pagamento_confirmado', 'email', 'Pagamento confirmado',
     'Pagamento de {{valor}} confirmado em {{data_pagamento}}. Obrigado!')
) AS v(tenant_id, event_type, channel, subject, body_template)
WHERE NOT EXISTS (
  SELECT 1 FROM notification_templates nt
  WHERE nt.tenant_id IS NULL AND nt.event_type = v.event_type AND nt.channel = v.channel
);

COMMENT ON TABLE communication_events IS 'Registro de envios (email/WhatsApp) por cobranca.';
COMMENT ON TABLE notification_templates IS 'Templates por tenant; tenant_id NULL = padrao do sistema.';
COMMENT ON TABLE charging_rules IS 'Regras da regua (days_offset negativo = antes do vencimento).';
