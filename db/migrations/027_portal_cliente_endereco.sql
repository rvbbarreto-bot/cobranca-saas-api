-- P2.2: endereco do pagador em portal.cliente (emissao gateway Inter/Cora/C6).

ALTER TABLE portal.cliente
  ADD COLUMN IF NOT EXISTS endereco_cep TEXT,
  ADD COLUMN IF NOT EXISTS endereco_logradouro TEXT,
  ADD COLUMN IF NOT EXISTS endereco_numero TEXT,
  ADD COLUMN IF NOT EXISTS endereco_complemento TEXT,
  ADD COLUMN IF NOT EXISTS endereco_bairro TEXT,
  ADD COLUMN IF NOT EXISTS endereco_cidade TEXT,
  ADD COLUMN IF NOT EXISTS endereco_uf CHAR(2);

COMMENT ON COLUMN portal.cliente.endereco_cep IS 'CEP (8 digitos, somente numeros).';
COMMENT ON COLUMN portal.cliente.endereco_uf IS 'UF (2 letras).';
