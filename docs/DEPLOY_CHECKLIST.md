# Deploy — Checklist (staging / produção)

Atualizado na **Sprint D** (inbox idempotência + endurecimento produção). Ver também [PRODUCAO_ENDURECIMENTO_PASSO_A_PASSO.md](./PRODUCAO_ENDURECIMENTO_PASSO_A_PASSO.md).

---

## Homolog Sprint 1 (antes de produção)

- [ ] [SPRINT1_ACEITE_CHECKLIST.md](./evidencias/SPRINT1_ACEITE_CHECKLIST.md) assinado pelo PO/Tech Lead
- [ ] `npm run e2e:asaas:evidence` executado em sandbox (evidência anexada ao ticket, **não** no git)
- [ ] `npm run quality:gate` verde na branch de release

---

## Antes de subir

### Banco e migrations

- [ ] `npm run migrate` → cadeia aplicada até **`024_asaas_platform_subscription_billing.sql`** (inclui `023` planos/assinaturas)
- [ ] **Não** rodar `npm run seed:dev` em produção real (apenas homolog controlado)

### Variáveis de ambiente (produção)

| Variável | Valor / regra |
|----------|----------------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Postgres com TLS se exigido |
| `JWT_SECRET` | ≥ 32 caracteres (recomendado 64+) |
| `WEBHOOK_INBOX_SECRET` | **Obrigatório** — sem ele, `POST /v1/inbox/webhooks` → **503** |
| `ENABLE_MOCK_AUTH` | **`false`** explícito (mock auth/provision desligados) |
| `ENCRYPTION_KEY` | 32 bytes hex (credenciais gateway no portal) |
| `PORTAL_CLIENT_URL` | URL do frontend publicado |
| `N8N_PLATFORM_WEBHOOK_URL` | Opcional — outbound n8n; vazio = noop |
| `N8N_PLATFORM_WEBHOOK_SECRET` | Opcional — header `X-Webhook-Secret` para o trigger n8n |

Validação local antes do deploy:

```bash
npm run check:readiness
# ou
npm run check:prod-env -- --strict
```

### Redis / filas

- [ ] Filas BullMQ atuais: `charges-emission`, `inbox-process`, `charges-sync`, `notifications-send`
- [ ] Limpar chaves legadas com `:` se migração de deploy anterior:

```bash
redis-cli KEYS "bull:charges:emission*" | xargs -r redis-cli DEL
redis-cli KEYS "bull:notifications:send*" | xargs -r redis-cli DEL
```

---

## Gate de qualidade (CI / pré-merge)

```bash
npm run quality:gate
```

Inclui `build`, `test:coverage` (≥ 82% no escopo unitário), `portal:test` e `test:integration` (requer `DATABASE_URL` + schema migrado).

Integração inbox (Sprint D):

```bash
npx vitest run tests/inbox/webhook-inbox-idempotency.integration.test.ts
```

---

## Verificação pós-deploy

- [ ] `GET /health/ready` → 200
- [ ] `POST /v1/inbox/webhooks` com `X-Webhook-Secret` + `X-External-Event-Id` → **202**; reenvio → **200** `deduplicated: true` (smoke)
- [ ] `GET /v1/portal/escritorio/dashboard` → 200
- [ ] `GET /v1/saas/plans` (JWT owner) → planos
- [ ] Confirmar mocks desligados: `POST /v1/auth/token/mock` → **404** ou desabilitado quando `ENABLE_MOCK_AUTH=false`
- [ ] Scripts bash de validação (Linux/macOS ou WSL): `validacao_fase_0.sh`, `validacao_sprint3.sh`, `validacao_sprint4.sh`

---

## Evidências Sprint 1 / Asaas (homolog, não no repo)

Checklist: [evidencias/SPRINT1_ACEITE_CHECKLIST.md](./evidencias/SPRINT1_ACEITE_CHECKLIST.md).

```bash
# Pré-requisitos: migrate, seed:dev (homolog), ASAAS_API_KEY sandbox, secrets no .env
npm run e2e:asaas:evidence
```

Gera `docs/evidencias/asaas-e2e-*.json` (gitignored). Ver [evidencias/README.md](./evidencias/README.md). Não commitar `.env` nem API keys.

---

## Referências

- Contrato inbox: [INBOX_WEBHOOK_IDEMPOTENCIA.md](./INBOX_WEBHOOK_IDEMPOTENCIA.md)
- n8n outbound + workflow: [N8N_WEBHOOKS.md](./N8N_WEBHOOKS.md), [N8N_REGUA_WORKFLOW_EXEMPLO.md](./N8N_REGUA_WORKFLOW_EXEMPLO.md)
- API geral: [API_CONTRATO_E_SMOKE.md](./API_CONTRATO_E_SMOKE.md)
- DoD fase 2: [FASE2_KICKOFF_QUALIDADE.md](./FASE2_KICKOFF_QUALIDADE.md)
