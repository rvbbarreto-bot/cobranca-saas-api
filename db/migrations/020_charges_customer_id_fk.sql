-- Tech debt (backlog): FK portal.cliente em charges.
-- Spec original: 017_charges_customer_id_fk.sql (017 ja ocupado por payment_gateway_raw_payload).

ALTER TABLE charges
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES portal.cliente (id);

UPDATE charges
SET customer_id = (metadata->>'portal_cliente_id')::uuid
WHERE customer_id IS NULL
  AND NULLIF(metadata->>'portal_cliente_id', '') IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_charges_customer_id ON charges (customer_id);

COMMENT ON COLUMN charges.customer_id IS
  'Cliente portal vinculado; backfill de metadata.portal_cliente_id.';
