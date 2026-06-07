-- EXEQ Platform Master: operadores internos + módulos habilitados por escritório.
-- Camada acima do RBAC do portal (admin_escritorio / operador).

ALTER TABLE portal.app_user
  ADD COLUMN IF NOT EXISTS is_platform_master BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN portal.app_user.is_platform_master IS
  'Usuário EXEQ com acesso ao console master (/exeq). Não substitui membership por escritório.';

CREATE TABLE IF NOT EXISTS portal.tenant_module (
  tenant_id TEXT NOT NULL,
  module_key TEXT NOT NULL CHECK (
    module_key IN ('cobranca', 'notas_fiscais', 'fiscal_guias', 'relatorios', 'clientes')
  ),
  enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, module_key)
);

CREATE INDEX IF NOT EXISTS idx_tenant_module_tenant ON portal.tenant_module (tenant_id);

COMMENT ON TABLE portal.tenant_module IS
  'Feature flags por escritório (automacao.tenants.id em texto). Controla menu e APIs do portal.';
