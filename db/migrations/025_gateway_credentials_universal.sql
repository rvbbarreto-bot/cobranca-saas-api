-- Sprint L: credenciais JSON cifradas + providers inter/cora.

ALTER TABLE escritorio_config
  ADD COLUMN IF NOT EXISTS gateway_credentials_encrypted TEXT;

COMMENT ON COLUMN escritorio_config.gateway_credentials_encrypted IS
  'JSON de credenciais cifrado (AES-256-GCM). Bancos mTLS usam este campo; Asaas pode continuar em gateway_api_key_encrypted ate migracao.';

ALTER TABLE escritorio_config DROP CONSTRAINT IF EXISTS escritorio_config_gateway_provider_check;

ALTER TABLE escritorio_config
  ADD CONSTRAINT escritorio_config_gateway_provider_check
  CHECK (gateway_provider IN ('asaas', 'pagarme', 'inter', 'cora'));

ALTER TABLE payment_transactions DROP CONSTRAINT IF EXISTS payment_transactions_gateway_check;

ALTER TABLE payment_transactions
  ADD CONSTRAINT payment_transactions_gateway_check
  CHECK (gateway IN ('asaas', 'pagarme', 'inter', 'cora'));
