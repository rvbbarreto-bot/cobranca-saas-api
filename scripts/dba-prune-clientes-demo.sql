-- DBA: mantém só CPF 32800160888 e 26391118841 no escritorio-demo; remove demais clientes.
-- Uso: docker compose exec -T postgres psql -U app -d cobranca_saas -f - < scripts/dba-prune-clientes-demo.sql

BEGIN;

CREATE TEMP TABLE tmp_clientes_manter ON COMMIT DROP AS
SELECT c.id
FROM portal.cliente c
INNER JOIN automacao.tenants t ON c.tenant_id = t.id::text
WHERE t.slug = 'escritorio-demo'
  AND regexp_replace(c.documento, '\D', '', 'g') IN ('32800160888', '26391118841');

CREATE TEMP TABLE tmp_clientes_excluir ON COMMIT DROP AS
SELECT c.id
FROM portal.cliente c
INNER JOIN automacao.tenants t ON c.tenant_id = t.id::text
WHERE t.slug = 'escritorio-demo'
  AND c.id NOT IN (SELECT id FROM tmp_clientes_manter);

SELECT COUNT(*) AS excluir FROM tmp_clientes_excluir;
SELECT COUNT(*) AS manter FROM tmp_clientes_manter;

DELETE FROM fiscal.processamento_evento pe
USING fiscal.processamento_fiscal pf
WHERE pe.processamento_id = pf.id
  AND pf.portal_cliente_id IN (SELECT id FROM tmp_clientes_excluir);

DELETE FROM fiscal.processamento_fiscal
WHERE portal_cliente_id IN (SELECT id FROM tmp_clientes_excluir);

DELETE FROM fiscal.guia_pagamento gp
USING fiscal.guia_fiscal gf
WHERE gp.guia_fiscal_id = gf.id
  AND gf.portal_cliente_id IN (SELECT id FROM tmp_clientes_excluir);

DELETE FROM fiscal.guia_fiscal
WHERE portal_cliente_id IN (SELECT id FROM tmp_clientes_excluir);

DELETE FROM fiscal.certificado_digital
WHERE portal_cliente_id IN (SELECT id FROM tmp_clientes_excluir);

DELETE FROM fiscal.procuracao
WHERE portal_cliente_id IN (SELECT id FROM tmp_clientes_excluir);

UPDATE fiscal.certificate_vault
SET portal_cliente_id = NULL
WHERE portal_cliente_id IN (SELECT id FROM tmp_clientes_excluir);

DELETE FROM cliente_access_tokens
WHERE cliente_id IN (SELECT id FROM tmp_clientes_excluir);

UPDATE charges
SET customer_id = NULL
WHERE customer_id IN (SELECT id FROM tmp_clientes_excluir);

DELETE FROM portal.cliente
WHERE id IN (SELECT id FROM tmp_clientes_excluir);

SELECT COUNT(*) AS restantes_escritorio_demo
FROM portal.cliente c
INNER JOIN automacao.tenants t ON c.tenant_id = t.id::text
WHERE t.slug = 'escritorio-demo';

COMMIT;
