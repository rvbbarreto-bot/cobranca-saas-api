-- CI/tests paralelos podiam criar varios `automacao.tenants` com o mesmo slug;
-- o portal resolvia um id e o JWT carregava outro -> 403 cross_tenant.

WITH ranked AS (
  SELECT
    id,
    id::text AS id_text,
    lower(trim(slug)) AS slug_key,
    row_number() OVER (PARTITION BY lower(trim(slug)) ORDER BY id ASC) AS rn
  FROM automacao.tenants
  WHERE slug IS NOT NULL AND trim(slug) <> ''
),
dupes AS (
  SELECT r.slug_key, r.id_text AS old_id, c.id_text AS keep_id
  FROM ranked r
  INNER JOIN ranked c ON c.slug_key = r.slug_key AND c.rn = 1
  WHERE r.rn > 1
)
UPDATE portal.membership m
SET tenant_id = d.keep_id
FROM dupes d
WHERE m.tenant_id = d.old_id
  AND NOT EXISTS (
    SELECT 1
    FROM portal.membership m2
    WHERE m2.app_user_id = m.app_user_id
      AND m2.tenant_id = d.keep_id
  );

WITH ranked AS (
  SELECT
    id,
    id::text AS id_text,
    lower(trim(slug)) AS slug_key,
    row_number() OVER (PARTITION BY lower(trim(slug)) ORDER BY id ASC) AS rn
  FROM automacao.tenants
  WHERE slug IS NOT NULL AND trim(slug) <> ''
),
dupes AS (
  SELECT r.id_text AS old_id, c.id_text AS keep_id
  FROM ranked r
  INNER JOIN ranked c ON c.slug_key = r.slug_key AND c.rn = 1
  WHERE r.rn > 1
)
DELETE FROM portal.membership m
USING dupes d
WHERE m.tenant_id = d.old_id
  AND EXISTS (
    SELECT 1
    FROM portal.membership m2
    WHERE m2.app_user_id = m.app_user_id
      AND m2.tenant_id = d.keep_id
  );

WITH ranked AS (
  SELECT
    id,
    id::text AS id_text,
    lower(trim(slug)) AS slug_key,
    row_number() OVER (PARTITION BY lower(trim(slug)) ORDER BY id ASC) AS rn
  FROM automacao.tenants
  WHERE slug IS NOT NULL AND trim(slug) <> ''
),
dupes AS (
  SELECT r.id_text AS old_id, c.id_text AS keep_id
  FROM ranked r
  INNER JOIN ranked c ON c.slug_key = r.slug_key AND c.rn = 1
  WHERE r.rn > 1
)
INSERT INTO portal.billing_tenant_link (automacao_tenant_id, public_tenant_id)
SELECT d.keep_id, l.public_tenant_id
FROM portal.billing_tenant_link l
INNER JOIN dupes d ON l.automacao_tenant_id = d.old_id
ON CONFLICT (automacao_tenant_id) DO NOTHING;

WITH ranked AS (
  SELECT
    id,
    id::text AS id_text,
    lower(trim(slug)) AS slug_key,
    row_number() OVER (PARTITION BY lower(trim(slug)) ORDER BY id ASC) AS rn
  FROM automacao.tenants
  WHERE slug IS NOT NULL AND trim(slug) <> ''
),
dupes AS (
  SELECT r.id_text AS old_id
  FROM ranked r
  INNER JOIN ranked c ON c.slug_key = r.slug_key AND c.rn = 1
  WHERE r.rn > 1
)
DELETE FROM portal.billing_tenant_link l
USING dupes d
WHERE l.automacao_tenant_id = d.old_id;

WITH ranked AS (
  SELECT
    id,
    id::text AS id_text,
    lower(trim(slug)) AS slug_key,
    row_number() OVER (PARTITION BY lower(trim(slug)) ORDER BY id ASC) AS rn
  FROM automacao.tenants
  WHERE slug IS NOT NULL AND trim(slug) <> ''
),
dupes AS (
  SELECT r.id
  FROM ranked r
  INNER JOIN ranked c ON c.slug_key = r.slug_key AND c.rn = 1
  WHERE r.rn > 1
)
DELETE FROM automacao.tenants t
USING dupes d
WHERE t.id = d.id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_automacao_tenants_slug_ci
  ON automacao.tenants (lower(trim(slug)))
  WHERE slug IS NOT NULL AND trim(slug) <> '';
