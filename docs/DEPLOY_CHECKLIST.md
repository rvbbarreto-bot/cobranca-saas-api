# Deploy Sprint 3 — Checklist

## Antes de subir para staging/produção

- [ ] `npm run migrate` → `public.schema_migrations` com 25 registros; 021/022 aplicadas
- [ ] Verificar `PORTAL_CLIENT_URL` aponta para o frontend correto
- [ ] Redis limpo de filas legadas com hífen (se ainda não feito):

```bash
# Filas atuais (sem ':'): charges-emission, inbox-process, charges-sync, notifications-send
# Limpar chaves legadas com ':' se existirem de deploy anterior:
redis-cli KEYS "bull:charges:emission*" | xargs -r redis-cli DEL
redis-cli KEYS "bull:notifications:send*" | xargs -r redis-cli DEL
```

## Verificação pós-deploy

- [ ] `GET /health/ready` → 200
- [ ] `POST /v1/portal/cliente/auth/request-access` → 200 (sem revelar e-mail)
- [ ] `GET /v1/portal/escritorio/dashboard` → 200 com objeto JSON
- [ ] `GET /v1/portal/escritorio/cobrancas/export?format=csv` → stream CSV
- [ ] `bash Projeto_CobrancaBoleto/validacao_fase_0.sh` → 0 falhas
- [ ] `bash Projeto_CobrancaBoleto/validacao_sprint3.sh` → 0 falhas
- [ ] Confirmar: nenhuma rota `/nfse` existe (`grep -r "nfse" src/modules`)

## Teste E2E Sprint 3 (integração, com Postgres)

Com `DATABASE_URL` configurado e migrations aplicadas:

```bash
export DATABASE_URL="postgresql://..."
export JWT_SECRET="..."
export ENCRYPTION_KEY="$(openssl rand -hex 32)"
npx vitest run tests/portal-read/sprint3-e2e-flow.integration.test.ts
```

Cobre os 11 passos: PIX → emissão → webhook `PAYMENT_CONFIRMED` → magic link → portal cliente → dashboard → export CSV.
