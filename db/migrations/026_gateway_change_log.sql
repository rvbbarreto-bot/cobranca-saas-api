-- Sprint M: log de troca de gateway + providers bb/c6 nos CHECKs.

CREATE TABLE IF NOT EXISTS gateway_change_log (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           TEXT NOT NULL,
  old_provider        TEXT,
  new_provider        TEXT NOT NULL,
  changed_by_user_id  TEXT,
  changed_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_gateway_change_log_tenant
  ON gateway_change_log (tenant_id, changed_at DESC);

ALTER TABLE escritorio_config DROP CONSTRAINT IF EXISTS escritorio_config_gateway_provider_check;

ALTER TABLE escritorio_config
  ADD CONSTRAINT escritorio_config_gateway_provider_check
  CHECK (gateway_provider IN ('asaas', 'pagarme', 'inter', 'cora', 'bb', 'c6'));

ALTER TABLE payment_transactions DROP CONSTRAINT IF EXISTS payment_transactions_gateway_check;

ALTER TABLE payment_transactions
  ADD CONSTRAINT payment_transactions_gateway_check
  CHECK (gateway IN ('asaas', 'pagarme', 'inter', 'cora', 'bb', 'c6'));
