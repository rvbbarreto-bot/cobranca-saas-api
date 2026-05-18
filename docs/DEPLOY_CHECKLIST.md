# Deploy Sprint 3 — Pré-requisitos

## Antes de subir

- [ ] Rodar `npm run migrate` (migrations 021 e 022)
- [ ] Verificar `FOCUS_NFE_TOKEN` configurado em staging (homologação Focus NFe)
- [ ] Verificar `WEBHOOK_NFSE_SECRET` configurado e igual ao painel Focus NFe
- [ ] Verificar `PORTAL_CLIENT_URL` aponta para o frontend correto
- [ ] Redis limpo de filas antigas com hífen (se ainda não foi feito)

## Redis — flush de filas legadas (se necessário)

```bash
redis-cli DEL "bull:notifications-send:*"
redis-cli DEL "bull:charges-emission:*"
```

## Verificação pós-deploy

- [ ] `GET /health/ready` → 200
- [ ] `npm run migrate` roda sem erros
- [ ] `POST /v1/inbox/webhooks` com secret incorreto → 401
- [ ] `GET /v1/portal/escritorio/dashboard` → 200 (não 500)
- [ ] `bash Projeto_CobrancaBoleto/validacao_fase_0.sh` → 0 falhas
- [ ] `bash Projeto_CobrancaBoleto/validacao_sprint3.sh` → 0 falhas
