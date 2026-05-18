-- Execute este bloco PRIMEIRO se aparecer "schema portal does not exist".
-- Depois execute o arquivo completo 004_portal_web_multiescritorio.sql (inteiro, de uma vez).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS portal;

-- Confirmação (deve retornar uma linha com schema_name = portal):
-- SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'portal';
