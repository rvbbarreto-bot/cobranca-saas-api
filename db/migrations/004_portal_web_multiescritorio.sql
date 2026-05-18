-- Portal web (multi-escritório) no MESMO banco do n8n — schema isolado + vínculo com automacao.*
-- Executar no PostgreSQL onde já existem automacao.tenants e automacao.notas_fiscais.
--
-- IMPORTANTE (pgAdmin): execute o arquivo INTEIRO de uma vez (F5 sem seleção parcial).
-- Se aparecer "schema portal does not exist", rode antes: 004_fix_schema_portal_only.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS portal;

-- Permite filtrar NFs por escritório na plataforma (preencher via n8n no INSERT; ver docs)
ALTER TABLE automacao.notas_fiscais
  ADD COLUMN IF NOT EXISTS tenant_id TEXT;

CREATE INDEX IF NOT EXISTS idx_automacao_notas_fiscais_tenant_id
  ON automacao.notas_fiscais (tenant_id);

COMMENT ON COLUMN automacao.notas_fiscais.tenant_id IS
  'ID do registro em automacao.tenants (text/uuid) para RLS e painel; alinhar ao fluxo n8n Salvar Solicitacao NF.';

-- ---------------------------------------------------------------------------
-- Usuários do portal (não confundir com auth.users do Supabase — pode sincronizar depois)
-- ---------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS portal;

CREATE TABLE IF NOT EXISTS portal.app_user (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS portal.membership (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_user_id UUID NOT NULL REFERENCES portal.app_user (id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin_escritorio', 'operador', 'cliente_cnpj')),
  cpf_cnpj_cliente TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT membership_escopo CHECK (
    (role = 'cliente_cnpj' AND cpf_cnpj_cliente IS NOT NULL)
    OR (role IN ('admin_escritorio', 'operador') AND cpf_cnpj_cliente IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_membership_admin_op
  ON portal.membership (app_user_id, tenant_id)
  WHERE role IN ('admin_escritorio', 'operador');

CREATE UNIQUE INDEX IF NOT EXISTS uq_membership_cliente
  ON portal.membership (app_user_id, tenant_id, cpf_cnpj_cliente)
  WHERE role = 'cliente_cnpj';

CREATE INDEX IF NOT EXISTS idx_membership_tenant ON portal.membership (tenant_id);

COMMENT ON TABLE portal.app_user IS 'Usuários que acessam o portal web; email único.';
COMMENT ON TABLE portal.membership IS 'Vínculo usuário ↔ tenant (escritório) e papel; cliente restrito a um CNPJ.';

-- ---------------------------------------------------------------------------
-- View estável para telas (contrato da API / Lovable) — não altera o fluxo n8n
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW portal.vw_notas_fiscais_resumo AS
SELECT
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
  'Resumo para dashboard; JOIN com tenants quando tenant_id estiver preenchido na NF.';

-- ---------------------------------------------------------------------------
-- Papel técnico só leitura (opcional): criar role e conceder ao usuário do app web
-- Descomente e ajuste o nome do usuário após criar no Postgres:
-- CREATE ROLE portal_web_reader NOLOGIN;
-- GRANT USAGE ON SCHEMA portal TO portal_web_reader;
-- GRANT SELECT ON portal.vw_notas_fiscais_resumo TO portal_web_reader;
-- GRANT SELECT ON portal.app_user TO portal_web_reader;
-- GRANT SELECT ON portal.membership TO portal_web_reader;
-- GRANT USAGE ON SCHEMA automacao TO portal_web_reader;
-- GRANT SELECT ON automacao.tenants TO portal_web_reader;
-- GRANT portal_web_reader TO seu_usuario_app;
