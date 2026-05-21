# Runbook — Autenticação e secrets em produção

Fonte única para Tech Lead, DevOps e fábrica antes/depois de deploy da API `cobranca-saas-api`.

Documentos relacionados:

- [DEPLOY_CHECKLIST.md](./DEPLOY_CHECKLIST.md)
- [PRODUCAO_ENDURECIMENTO_PASSO_A_PASSO.md](./PRODUCAO_ENDURECIMENTO_PASSO_A_PASSO.md)
- [API_CONTRATO_E_SMOKE.md](./API_CONTRATO_E_SMOKE.md) (secção 4 — variáveis)

---

## 1. Variáveis obrigatórias

| Variável | Regra em produção |
|----------|-------------------|
| `NODE_ENV` | `production` |
| `JWT_SECRET` | ≥ 32 caracteres, aleatório forte; **sem** placeholders (`TROCAR`, `change-me`, etc.) |
| `WEBHOOK_INBOX_SECRET` | Obrigatório — sem ele, `POST /v1/inbox/webhooks` → **503** |
| `ENABLE_MOCK_AUTH` | **`false`** explícito (recomendado mesmo com `NODE_ENV=production`) |
| `DATABASE_URL` | Postgres com TLS (`sslmode=require` ou equivalente) |
| `CORS_ORIGIN` | Origens HTTPS do portal (vírgula se várias) |

Gerar secrets (exemplos — **não** commitar saída):

```bash
openssl rand -base64 64    # JWT_SECRET
openssl rand -hex 32       # WEBHOOK_INBOX_SECRET
```

---

## 2. Verificação antes do deploy

```bash
cd cobranca-saas-api
npm run build

# Checagem estrita de env (falha se placeholder ou mock ligado)
NODE_ENV=production ENABLE_MOCK_AUTH=false npm run check:prod-env -- --strict

# Readiness: Postgres + schema + env
npm run check:readiness
```

Em pipeline CI local, se a URL do Postgres **não** tiver TLS (ex.: serviço de teste):

```bash
ALLOW_INSECURE_DATABASE_URL=1 NODE_ENV=production ENABLE_MOCK_AUTH=false npm run check:prod-env -- --strict
```

---

## 3. Smoke pós-deploy

Substitua `https://api.exemplo` e credenciais reais.

### 3.1 Rotas mock devem retornar 404

```bash
curl -s -o /dev/null -w "%{http_code}" -X POST https://api.exemplo/v1/auth/token/mock -H "x-tenant-id: demo"
# esperado: 404

curl -s -o /dev/null -w "%{http_code}" -X POST https://api.exemplo/v1/portal/auth/token/mock \
  -H "Content-Type: application/json" -d '{"email":"x@y.com","tenant_id":"1"}'
# esperado: 404

curl -s -o /dev/null -w "%{http_code}" -X POST https://api.exemplo/v1/tenants/provision/mock \
  -H "Authorization: Bearer x" -H "x-tenant-id: 00000000-0000-4000-8000-000000000001"
# esperado: 404
```

Corpo típico: `{ "error": "not_found", "message": "Rota indisponivel neste ambiente." }`

### 3.2 Login real do portal (homolog)

Após `npm run seed:dev` **apenas em homolog**:

```bash
curl -s -X POST https://api.exemplo/v1/portal/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"portal-seed@local.dev","tenant_id":"<automacao_tenant_id>","password":"<senha>"}'
# esperado: 200 + access_token
```

Em produção real: usuários criados pelo processo de onboarding da empresa — **não** usar seed.

---

## 4. Rotas: mock vs real

| Uso | Método | Rota | Produção |
|-----|--------|------|----------|
| Token core dev | POST | `/v1/auth/token/mock` | **404** |
| Token portal dev | POST | `/v1/portal/auth/token/mock` | **404** |
| Provision stub dev | POST | `/v1/tenants/provision/mock` | **404** |
| Login portal | POST | `/v1/portal/auth/login` | **200** (credencial válida) |
| Provision real | POST | `/v1/tenants/provision` | JWT core owner/admin |

Implementação: `src/platform/config/runtime-flags.ts`, middleware `mock-auth-routes-gate.ts`.

---

## 5. Rotação de `JWT_SECRET`

1. **Planejar janela** — todos os JWT em circulação invalidam **imediatamente** após o redeploy.
2. **Gerar** novo secret (≥ 32 chars, recomendado 64+ aleatório) no cofre (Azure Key Vault, AWS SM, etc.).
3. **Atualizar** variável no ambiente de produção (sem commit no git).
4. **Redeploy** da API; confirmar boot sem avisos `[boot] AVISO` relacionados a JWT.
5. **Comunicar** utilizadores do portal para novo login.
6. **Registrar** data, executor e ticket de change (auditoria).

Não é suportada rotação gradual com dois secrets no mesmo deploy nesta versão.

---

## 6. Regressão automatizada

| Teste | Comando |
|-------|---------|
| Política JWT | `npx vitest run tests/platform/jwt-secret-policy.test.ts` |
| Mocks 404 em produção | `npx vitest run tests/functional/production-mock-auth-gate.integration.test.ts` |
| Gate completo | `npm run quality:gate` |

---

## 7. Troubleshooting

| Sintoma | Causa provável | Ação |
|---------|----------------|------|
| `check:prod-env` falha JWT | Placeholder no `.env` | Gerar secret forte; ver `jwt-secret-policy.ts` |
| Mock retorna 200 em prod | `ENABLE_MOCK_AUTH=true` ou `NODE_ENV` ≠ production | Corrigir env; redeploy |
| Portal não loga | CORS ou credencial | Ver `CORS_ORIGIN`; login via `/v1/portal/auth/login` |
| Webhook 503 | `WEBHOOK_INBOX_SECRET` ausente | Definir secret; header `X-Webhook-Secret` no cliente |

---

*FASE2 A — Maio 2026. Atualizar este runbook quando mudar superfície de auth.*
