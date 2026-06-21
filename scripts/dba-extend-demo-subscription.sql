-- DBA dev: reativa trial do tenant publico demo (escritorio-demo) — permite criar clientes de novo.
-- Uso: docker compose exec -T postgres psql -U app -d cobranca_saas -f - < scripts/dba-extend-demo-subscription.sql

UPDATE assinaturas a
SET
  status = 'trial',
  trial_ends_at = now() + interval '365 days',
  current_period_start = now(),
  current_period_end = now() + interval '365 days',
  read_only = false,
  updated_at = now()
FROM tenants t
WHERE a.tenant_id = t.id
  AND t.slug = 'demo';

SELECT
  t.slug,
  a.status,
  a.read_only,
  a.trial_ends_at,
  a.current_period_end,
  p.nome AS plano
FROM assinaturas a
INNER JOIN tenants t ON t.id = a.tenant_id
INNER JOIN planos p ON p.id = a.plano_id
WHERE t.slug = 'demo';
