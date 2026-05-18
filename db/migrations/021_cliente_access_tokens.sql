-- Sprint 3: magic link para portal do cliente final.

CREATE TABLE IF NOT EXISTS cliente_access_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   TEXT NOT NULL,
  cliente_id  UUID NOT NULL REFERENCES portal.cliente (id),
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT now() + interval '15 minutes',
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cat_token ON cliente_access_tokens (token_hash);
CREATE INDEX IF NOT EXISTS idx_cat_cliente ON cliente_access_tokens (cliente_id);
