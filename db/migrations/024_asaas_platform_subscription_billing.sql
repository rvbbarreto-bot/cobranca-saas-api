-- Sprint 4.7 — Cobrança recorrente da assinatura SaaS via Asaas Subscriptions

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS billing_email TEXT;

COMMENT ON COLUMN tenants.billing_email IS
  'E-mail de cobrança do plano SaaS (Asaas customer). Opcional no provision.';

ALTER TABLE assinaturas
  ADD COLUMN IF NOT EXISTS gateway_customer_id TEXT;

CREATE INDEX IF NOT EXISTS idx_assinaturas_gateway_subscription
  ON assinaturas (gateway_subscription_id)
  WHERE gateway_subscription_id IS NOT NULL;
