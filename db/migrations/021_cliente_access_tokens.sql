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

INSERT INTO notification_templates (tenant_id, event_type, channel, subject, body_template)
VALUES
  (NULL, 'magic_link', 'email',
   'Seu link de acesso — {{escritorio_nome}}',
   'Clique no link abaixo para acessar suas cobranças (válido por 15 minutos):\n{{magic_link_url}}')
ON CONFLICT (tenant_id, event_type, channel) DO NOTHING;
