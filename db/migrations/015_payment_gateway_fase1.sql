-- Sprint 1 / Fase 1: payment_transactions + evolucao portal.cliente (Asaas).
-- Idempotente: IF NOT EXISTS, ADD COLUMN IF NOT EXISTS, DROP POLICY IF EXISTS.

-- ---------------------------------------------------------------------------
-- TABELA 1: payment_transactions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_transactions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id              TEXT NOT NULL,
  charge_id              UUID NOT NULL REFERENCES charges (id) ON DELETE RESTRICT,
  gateway                TEXT NOT NULL CHECK (gateway IN ('asaas', 'pagarme')),
  gateway_transaction_id TEXT UNIQUE,
  type                   TEXT NOT NULL CHECK (type IN ('boleto', 'pix')),
  status                 TEXT NOT NULL DEFAULT 'pending',
  amount                 NUMERIC(14, 2) NOT NULL,
  boleto_url             TEXT,
  boleto_pdf_url         TEXT,
  boleto_barcode         TEXT,
  pix_qrcode_base64      TEXT,
  pix_emv                TEXT,
  pix_link               TEXT,
  expires_at             TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ptx_charge
  ON payment_transactions (charge_id);

CREATE INDEX IF NOT EXISTS idx_ptx_tenant
  ON payment_transactions (tenant_id);

CREATE INDEX IF NOT EXISTS idx_ptx_gateway
  ON payment_transactions (gateway_transaction_id)
  WHERE gateway_transaction_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- TABELA 2: portal.cliente (criada em 009; aqui garante colunas do contrato)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS portal.cliente (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           TEXT NOT NULL,
  documento           TEXT NOT NULL,
  tipo_documento      TEXT NOT NULL CHECK (tipo_documento IN ('cpf', 'cnpj')),
  nome                TEXT NOT NULL,
  email               TEXT NOT NULL,
  telefone            TEXT,
  opt_in_email        BOOLEAN NOT NULL DEFAULT true,
  opt_in_whatsapp     BOOLEAN NOT NULL DEFAULT false,
  gateway_customer_id TEXT,
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_portal_cliente_doc UNIQUE (tenant_id, documento)
);

-- Evolucao quando 009_portal_cliente.sql ja criou a tabela (sem tipo_documento / email NOT NULL)
ALTER TABLE portal.cliente
  ADD COLUMN IF NOT EXISTS tipo_documento TEXT;

ALTER TABLE portal.cliente
  ADD COLUMN IF NOT EXISTS telefone TEXT;

ALTER TABLE portal.cliente
  ADD COLUMN IF NOT EXISTS opt_in_email BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE portal.cliente
  ADD COLUMN IF NOT EXISTS opt_in_whatsapp BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE portal.cliente
  ADD COLUMN IF NOT EXISTS gateway_customer_id TEXT;

ALTER TABLE portal.cliente
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE portal.cliente
SET tipo_documento = CASE
  WHEN char_length(documento) = 11 THEN 'cpf'
  WHEN char_length(documento) = 14 THEN 'cnpj'
  ELSE 'cpf'
END
WHERE tipo_documento IS NULL;

UPDATE portal.cliente
SET email = 'sem-email+' || id::text || '@cobranca.local'
WHERE email IS NULL OR trim(email) = '';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'portal'
      AND table_name = 'cliente'
      AND column_name = 'whatsapp_opt_in'
  ) THEN
    UPDATE portal.cliente
    SET opt_in_whatsapp = COALESCE(whatsapp_opt_in, false)
    WHERE opt_in_whatsapp IS DISTINCT FROM COALESCE(whatsapp_opt_in, false);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'portal'
      AND table_name = 'cliente'
      AND column_name = 'tipo_documento'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE portal.cliente
      ALTER COLUMN tipo_documento SET NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'portal'
      AND table_name = 'cliente'
      AND column_name = 'email'
      AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE portal.cliente
      ALTER COLUMN email SET NOT NULL;
  END IF;
END $$;

ALTER TABLE portal.cliente DROP CONSTRAINT IF EXISTS chk_portal_cliente_tipo_documento;

ALTER TABLE portal.cliente
  ADD CONSTRAINT chk_portal_cliente_tipo_documento
  CHECK (tipo_documento IN ('cpf', 'cnpj'));

ALTER TABLE portal.cliente ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON portal.cliente;
DROP POLICY IF EXISTS portal_cliente_tenant_isolation ON portal.cliente;

CREATE POLICY tenant_isolation ON portal.cliente
  FOR ALL
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

CREATE INDEX IF NOT EXISTS idx_portal_cliente_tenant
  ON portal.cliente (tenant_id);

CREATE INDEX IF NOT EXISTS idx_portal_cliente_gateway_customer
  ON portal.cliente (gateway_customer_id)
  WHERE gateway_customer_id IS NOT NULL;
