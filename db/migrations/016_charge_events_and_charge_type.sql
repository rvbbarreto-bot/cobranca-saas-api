-- Emissao via gateway: tipo da cobranca + historico de eventos.

ALTER TABLE charges
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'boleto';

ALTER TABLE charges DROP CONSTRAINT IF EXISTS chk_charges_type;

ALTER TABLE charges
  ADD CONSTRAINT chk_charges_type CHECK (type IN ('boleto', 'pix'));

CREATE TABLE IF NOT EXISTS charge_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants (id) ON DELETE CASCADE,
  charge_id UUID NOT NULL REFERENCES charges (id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  old_status TEXT,
  new_status TEXT,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_charge_events_charge ON charge_events (charge_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_charge_events_tenant ON charge_events (tenant_id, created_at DESC);

ALTER TABLE charge_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS charge_events_tenant_isolation ON charge_events;

CREATE POLICY charge_events_tenant_isolation ON charge_events
  FOR ALL
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);
