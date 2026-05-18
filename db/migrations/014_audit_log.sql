-- TAREFA 0.7: auditoria de mutacoes criticas (charge, cliente, membership, etc.).

CREATE TABLE IF NOT EXISTS audit_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     TEXT NOT NULL,
  user_id       TEXT,
  action        TEXT NOT NULL
                CHECK (action IN ('create','update','delete','cancel','status_change','login','manual_payment')),
  resource_type TEXT NOT NULL,
  resource_id   TEXT NOT NULL,
  old_value     JSONB,
  new_value     JSONB,
  ip_address    TEXT,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_tenant_resource ON audit_log(tenant_id, resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_tenant_date ON audit_log(tenant_id, created_at DESC);
