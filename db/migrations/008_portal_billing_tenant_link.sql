-- Liga o escritório do portal/n8n (automacao.tenants, id em texto) ao tenant UUID
-- usado por billing-core (`public.tenants` + RLS em `charges`).
--
-- Pré-requisitos: `001_init_multi_tenant_rls.sql` (tabela `tenants` e `charges`) e
-- `004_portal_web_multiescritorio.sql` (schema `portal`) já aplicados no mesmo banco.

CREATE TABLE IF NOT EXISTS portal.billing_tenant_link (
  automacao_tenant_id TEXT NOT NULL PRIMARY KEY,
  public_tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_billing_tenant_link_public
  ON portal.billing_tenant_link (public_tenant_id);

COMMENT ON TABLE portal.billing_tenant_link IS
  'Um escritório em automacao.tenants (mesmo valor de portal.membership.tenant_id) aponta para o UUID em public.tenants para leitura de cobranças no portal.';

-- Exemplo (ajuste IDs ao seu ambiente):
-- INSERT INTO portal.billing_tenant_link (automacao_tenant_id, public_tenant_id)
-- SELECT t.id::text, pt.id
-- FROM automacao.tenants t
-- CROSS JOIN tenants pt
-- WHERE t.id = 1 AND pt.slug = 'demo'
-- ON CONFLICT (automacao_tenant_id) DO UPDATE SET public_tenant_id = EXCLUDED.public_tenant_id;
