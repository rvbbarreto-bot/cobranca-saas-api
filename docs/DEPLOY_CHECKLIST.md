# Deploy Sprint 3 — Checklist

## Antes de subir para staging/produção

- [ ] `npm run migrate` → confirmar migration 021 aplicada
- [ ] Verificar `PORTAL_CLIENT_URL` aponta para o frontend correto
- [ ] Redis limpo de filas legadas com hífen (se ainda não feito):

```bash
redis-cli DEL "bull:notifications-send:*"
redis-cli DEL "bull:charges-emission:*"
```

## Verificação pós-deploy

- [ ] `GET /health/ready` → 200
- [ ] `POST /v1/portal/cliente/auth/request-access` → 200 (sem revelar e-mail)
- [ ] `GET /v1/portal/escritorio/dashboard` → 200 com objeto JSON
- [ ] `GET /v1/portal/escritorio/cobrancas/export?format=csv` → stream CSV
- [ ] `bash Projeto_CobrancaBoleto/validacao_fase_0.sh` → 0 falhas
- [ ] `bash Projeto_CobrancaBoleto/validacao_sprint3.sh` → 0 falhas
- [ ] Confirmar: nenhuma rota `/nfse` existe (`grep -r "nfse" src/modules`)
