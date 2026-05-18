-- Política descrição do serviço × competência (V12 workflow).
-- DEFAULT 'off' preserva comportamento homologado V11 sem migração de dados.

ALTER TABLE automacao.tenants
  ADD COLUMN IF NOT EXISTS descricao_competencia_check TEXT NOT NULL DEFAULT 'off';

COMMENT ON COLUMN automacao.tenants.descricao_competencia_check IS
  'off | warn | block — valida padrões explícitos de mês/ano na descrição vs data de competência (DD/MM/AAAA).';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_automacao_tenants_descricao_competencia_check'
  ) THEN
    ALTER TABLE automacao.tenants
      ADD CONSTRAINT chk_automacao_tenants_descricao_competencia_check
      CHECK (descricao_competencia_check IN ('off', 'warn', 'block'));
  END IF;
END $$;
