-- Índices e notas de performance para o schema `automacao` (n8n / WhatsApp / NF).
-- Pré-requisito: tabelas já existentes. Executar após baseline do schema automacao.
-- Em produção pesada, avaliar CREATE INDEX CONCURRENTLY fora da transação única do migrate.

-- Resolver Tenant SaaS: JOIN por instância WhatsApp (predicado mais seletivo no ORDER BY)
CREATE INDEX IF NOT EXISTS idx_automacao_tenants_whatsapp_instance_ativo
  ON automacao.tenants (whatsapp_instance)
  WHERE ativo = TRUE;

-- Resolver Tenant SaaS: segundo ramo do OR — match por dígitos do telefone (alinhado ao regexp_replace da query)
CREATE INDEX IF NOT EXISTS idx_automacao_tenants_sender_digits_ativo
  ON automacao.tenants (regexp_replace(COALESCE(whatsapp_sender_number, ''), '\D', '', 'g'))
  WHERE ativo = TRUE
    AND COALESCE(whatsapp_sender_number, '') <> '';

-- Atualizar retorno NF / idempotência de solicitação por referência externa
CREATE INDEX IF NOT EXISTS idx_automacao_notas_fiscais_referencia_externa
  ON automacao.notas_fiscais (referencia_externa);

-- Contexto de conversa por chat_id (SELECT/UPSERT/DELETE no fluxo)
CREATE INDEX IF NOT EXISTS idx_automacao_contexto_nf_chat_id
  ON automacao.contexto_nf (chat_id);

--COMMENT ON INDEX idx_automacao_tenants_whatsapp_instance_ativo IS 'Suporta LEFT JOIN automacao.tenants por whatsapp_instance quando ativo.';
--COMMENT ON INDEX idx_automacao_tenants_sender_digits_ativo IS 'Suporta match por somente dígitos do whatsapp_sender_number.';
