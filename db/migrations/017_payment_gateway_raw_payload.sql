-- Auditoria: resposta bruta do gateway na tentativa de pagamento.

ALTER TABLE payment_transactions
  ADD COLUMN IF NOT EXISTS gateway_raw_response JSONB;

COMMENT ON COLUMN payment_transactions.gateway_raw_response IS
  'Payload bruto retornado pelo provedor (ex.: POST /payments Asaas) para auditoria.';
