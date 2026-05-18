-- Suporte a reprocessamento e diagnóstico de falhas na fila de webhooks.

ALTER TABLE webhook_inbox
  ADD COLUMN IF NOT EXISTS last_error TEXT;

ALTER TABLE webhook_inbox
  ADD COLUMN IF NOT EXISTS processing_attempts INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_webhook_inbox_pending_tenant_created
  ON webhook_inbox (tenant_id, created_at)
  WHERE processed_at IS NULL;

COMMENT ON COLUMN webhook_inbox.last_error IS 'Ultima falha ao processar o evento; processed_at pode estar preenchido para mensagens mortas.';
