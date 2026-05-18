-- Complemento Sprint 2 (tabelas base em 016_notifications_regua.sql).

ALTER TABLE charges
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

ALTER TABLE charges
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_comm_charge_event
  ON communication_events (charge_id, event_type, created_at DESC);

COMMENT ON TABLE communication_events IS 'Registro de envios (email/WhatsApp) por cobranca.';
COMMENT ON TABLE notification_templates IS 'Templates por tenant; tenant_id NULL = padrao do sistema.';
COMMENT ON TABLE charging_rules IS 'Regras da regua (days_offset negativo = antes do vencimento).';
