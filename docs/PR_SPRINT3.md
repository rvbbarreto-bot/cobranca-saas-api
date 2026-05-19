# Pull Request — Sprint 3: Portal do cliente + relatórios

**Branch:** `cursor/sprint3-portal-cliente-relatorios`  
**Base sugerida:** `main` (ou `feat/sprint1-payment-emission-portal` se o fluxo do repo for incremental)

## Summary

- Magic link do cliente final (`021_cliente_access_tokens`, `POST /v1/portal/cliente/auth/*`)
- Portal do devedor: listagem/detalhe/boleto com JWT `cliente_cnpj`
- Dashboard escritório (`GET /v1/portal/escritorio/dashboard`)
- Export CSV com mascaramento e rate limit (`GET /v1/portal/escritorio/cobrancas/export`)
- **Sem NFS-e** neste pacote (rotas/módulo removidos; legado `notas-fiscais` mantido)
- Portal web: dashboard/relatórios reais + área `/acesso` e `/cliente/cobrancas`
- Ops: migrations idempotentes (`schema_migrations`), filas BullMQ sem `:`, E2E `sprint3-e2e-flow`

## Test plan

- [ ] `npm run build` / `npm run check`
- [ ] `npm test` (167+ unitários)
- [ ] `npm run portal:test`
- [ ] `docker compose up -d` + `GET /health/ready` → 200
- [ ] `npm run test:integration:sprint3:docker` (E2E 11 passos, requer rebuild `migrate` após pull)
- [ ] `bash Projeto_CobrancaBoleto/validacao_sprint3.sh`
- [ ] Smoke: magic link + dashboard + CSV export no portal web

## Deploy notes

- `DB_PASSWORD` no `.env` alinhado ao Postgres existente
- `PORTAL_CLIENT_URL` para links do cliente
- Limpar filas Redis legadas com `:` se staging já rodou versão antiga (ver `docs/DEPLOY_CHECKLIST.md`)

## Critério de merge

- CI verde
- Sem regressão Sprint 1/2 (webhook, emissão, notificações)
- Aprovação PO: fluxo E2E Sprint 3 demonstrado
