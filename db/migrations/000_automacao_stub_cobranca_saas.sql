-- Stub mínimo do schema `automacao` para banco NOVO dedicado à API de cobrança
-- (sem instalação prévia do n8n / Projeto_EmissaoNF).
--
-- Permite que as migrações 002–007 e a view em 004 executem sem erro.
-- Se o banco já tiver `automacao.*` real, os CREATE IF NOT EXISTS são ignorados.
--
-- Dados de NF permanecem vazios até integrar com o fluxo real; portal e billing
-- usam `public.tenants` + `portal.billing_tenant_link` conforme documentação.

CREATE SCHEMA IF NOT EXISTS automacao;

CREATE TABLE IF NOT EXISTS automacao.tenants (
  id SERIAL PRIMARY KEY,
  slug TEXT,
  nome TEXT,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  whatsapp_instance TEXT,
  whatsapp_sender_number TEXT
);

CREATE TABLE IF NOT EXISTS automacao.notas_fiscais (
  id BIGSERIAL PRIMARY KEY,
  referencia_externa TEXT,
  chat_id TEXT,
  tipo_documento TEXT,
  ambiente TEXT,
  data_emissao TIMESTAMPTZ,
  data_competencia DATE,
  natureza_operacao TEXT,
  cpf_cnpj_tomador TEXT,
  nome_tomador TEXT,
  descricao_servico TEXT,
  valor_servicos NUMERIC,
  status_emissao TEXT,
  status_focus TEXT,
  numero_nfse TEXT,
  codigo_verificacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS automacao.contexto_nf (
  chat_id TEXT NOT NULL PRIMARY KEY,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb
);

COMMENT ON SCHEMA automacao IS
  'Stub opcional: em produção com n8n, substituído pelo schema real sem conflito (IF NOT EXISTS).';
