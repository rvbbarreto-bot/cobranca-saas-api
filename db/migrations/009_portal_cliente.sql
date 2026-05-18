-- Cadastro de clientes (tomadores / devedores) no escopo do portal por escritório.
-- Executar no mesmo PostgreSQL do schema `portal` (após 004).

CREATE TABLE IF NOT EXISTS portal.cliente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  documento TEXT NOT NULL,
  nome TEXT NOT NULL,
  email TEXT,
  whatsapp_opt_in BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_portal_cliente_tenant_documento UNIQUE (tenant_id, documento),
  CONSTRAINT chk_portal_cliente_documento_len CHECK (char_length(documento) IN (11, 14)),
  CONSTRAINT chk_portal_cliente_nome_len CHECK (char_length(trim(nome)) BETWEEN 1 AND 300)
);

CREATE INDEX IF NOT EXISTS idx_portal_cliente_tenant ON portal.cliente (tenant_id);

COMMENT ON TABLE portal.cliente IS
  'Clientes do escritório para cobrança / relacionamento; tenant_id alinha a portal.membership.tenant_id (automacao.tenants).';

COMMENT ON COLUMN portal.cliente.documento IS 'Somente dígitos: CPF (11) ou CNPJ (14).';
