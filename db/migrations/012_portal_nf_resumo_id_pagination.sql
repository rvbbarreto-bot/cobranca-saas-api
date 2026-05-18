-- Expõe id estável da NF na view do portal para paginação por cursor (P1).
-- DROP necessário: Postgres não permite CREATE OR REPLACE ao renomear colunas da view.

DROP VIEW IF EXISTS portal.vw_notas_fiscais_resumo;

CREATE VIEW portal.vw_notas_fiscais_resumo AS
SELECT
  nf.id::text AS id,
  nf.referencia_externa,
  nf.chat_id,
  nf.tipo_documento,
  nf.ambiente,
  nf.data_emissao,
  nf.data_competencia,
  nf.natureza_operacao,
  nf.cpf_cnpj_tomador,
  nf.nome_tomador,
  nf.descricao_servico,
  nf.valor_servicos,
  nf.status_emissao,
  nf.status_focus,
  nf.numero_nfse,
  nf.codigo_verificacao,
  nf.created_at,
  nf.updated_at,
  nf.tenant_id,
  t.id::text AS tenant_uuid_text,
  t.slug AS tenant_slug,
  t.nome AS tenant_nome
FROM automacao.notas_fiscais nf
LEFT JOIN automacao.tenants t
  ON t.id::text = nf.tenant_id
  AND nf.tenant_id IS NOT NULL;

COMMENT ON VIEW portal.vw_notas_fiscais_resumo IS
  'Resumo para dashboard; id = automacao.notas_fiscais.id (texto) para cursor de listagem.';
