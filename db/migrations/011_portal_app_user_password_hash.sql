-- Login portal real (Sprint A): hash de senha opcional em portal.app_user.
-- Usuarios sem password_hash continuam podendo usar fluxo mock em dev (se habilitado).

ALTER TABLE portal.app_user
  ADD COLUMN IF NOT EXISTS password_hash TEXT NULL;

COMMENT ON COLUMN portal.app_user.password_hash IS
  'bcrypt hash ($2a$...). Se NULL, POST /v1/portal/auth/login retorna erro especifico; mock sem senha permanece apenas para desenvolvimento.';
