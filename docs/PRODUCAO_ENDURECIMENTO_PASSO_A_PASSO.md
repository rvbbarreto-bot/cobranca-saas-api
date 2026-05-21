# Passo 3 — Endurecer produção (paralelo ao desenvolvimento)

**Runbook operacional (auth, JWT, mocks):** [RUNBOOK_AUTH_PRODUCAO.md](./RUNBOOK_AUTH_PRODUCAO.md) — preferir como checklist único em novos deploys.

Este guia assume que o **passo 2** já passou no seu ambiente: `migrate`, `seed:dev` (só **dev/homolog**), `npm run test:functional` com **10/10** verdes. O **escopo MVP** está congelado até a próxima entrega: [MVP_ESCOPO_CONGELADO.md](./MVP_ESCOPO_CONGELADO.md).

Em **produção** não use `seed:dev` com dados fictícios a menos que seja ambiente de homologação controlado; use usuários reais, `automacao` real ou política da empresa.

---

## 1. Resultado dos seus testes (interpretação)

| Etapa | Status |
|--------|--------|
| `npm run migrate` | OK — cadeia `000`–`010` aplicada no mesmo banco. |
| `npm run seed:dev` | OK — escritório `escritorio-demo` (`automacaoTenantId: '1'`), portal + link para tenant `demo`. |
| `npm run test:functional` | OK — **10/10**: health, core JWT, billing, inbox, process-pending, stub tenants, portal (NF + cobranças + clientes), isolamento cross-tenant. |

Pode seguir este documento com segurança para fechar **produção**.

---

## 2. Variáveis obrigatórias em produção

Defina no provedor (Azure App Settings, AWS Parameter Store / Secrets Manager, Kubernetes Secret → env do Pod, etc.):

| Variável | Regra |
|----------|--------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | URL Postgres com TLS se o provedor exigir (`?sslmode=require`). |
| `JWT_SECRET` | **Mínimo 32 caracteres** aleatórios (recomendado: 64+). Nunca commitar. |
| `WEBHOOK_INBOX_SECRET` | **Obrigatório**: sem ele, `POST /v1/inbox/webhooks` responde **503** (`webhook_inbox_misconfigured`). |
| `ENABLE_MOCK_AUTH` | **`false`** explícito em pipelines (em `production` os mocks já vêm desligados por padrão; o explícito evita surpresa se alguém mudar `NODE_ENV`). |

### 2.1 Se `check:prod-env --strict` falhar com `JWT_SECRET ausente ou com menos de 32 caracteres`

- O script carrega o arquivo **`.env` na pasta do projeto** (`dotenv`). O valor antigo `change-me-to-a-strong-secret` tem **28** caracteres e **não passa**.
- Ajuste no `.env`: `JWT_SECRET` com **≥ 32** caracteres (recomendado: aleatório longo; não commite o `.env` real).
- Exemplo só para testar o check no PowerShell (não use em produção como valor fixo):

```powershell
cd "...\Projeto_CobrancaBoleto\Projeto\cobranca-saas-api"
$env:NODE_ENV = "production"
$env:JWT_SECRET = "0123456789abcdefghijklmnopqrstuvwxyzABCD"  # 40 caracteres
$env:WEBHOOK_INBOX_SECRET = "whsec_dev_example_min_32_chars__________"
$env:DATABASE_URL = "postgres://..."   # mesma URL que voce ja usa
$env:ENABLE_MOCK_AUTH = "false"
npm run check:prod-env -- --strict
```

Recomendadas:

| Variável | Motivo |
|----------|--------|
| `CORS_ORIGIN` | Se o **portal** for consumido por browser em outro domínio, liste origens HTTPS separadas por vírgula. Sem isso, em produção o middleware **não** abre CORS genérico. |
| `PORT` | Se o PaaS não injetar porta, defina (ex.: `3333` ou a porta do container). |
| `PG_POOL_MAX` | Ajuste conforme vCPU / conexões do Postgres. |

Opcionais:

| Variável | Motivo |
|----------|--------|
| `ENABLE_HTTP_ACCESS_LOG` | `true` em produção para linhas JSON de acesso (default já liga fora de `test`). `false` só se outro agente coletar tráfego na borda. |
| `WEBHOOK_PROCESS_*` | Para o job `npm run job:webhook-inbox` / cron. |

---

## 3. O que o código já endurece automaticamente

Com `NODE_ENV=production`:

1. **Rotas mock** (`POST /v1/auth/token/mock`, `/v1/portal/auth/token/mock`, `/v1/tenants/provision/mock`) → **404**, salvo `ENABLE_MOCK_AUTH=true` (não use em produção real).
2. **`POST /v1/inbox/webhooks`** → **503** se `WEBHOOK_INBOX_SECRET` não estiver definido.
3. **Boot**: avisos no console se mocks ligados, `JWT_SECRET` fraco/ausente ou webhook sem segredo (`logProductionWarnings`).

Clientes HTTP devem enviar o mesmo segredo no header **`X-Webhook-Secret`** que o valor de `WEBHOOK_INBOX_SECRET`.

### 3.1 Readiness pack (A + B + C)

| Item | O que é |
|------|---------|
| **A** | `npm run check:db` — conexão real ao Postgres, `SELECT 1`, extensão `pgcrypto`, existência de `public.tenants`, `public.charges`, `portal.app_user`. |
| **B** | `GET /health/ready` — mesmo probe em runtime (Kubernetes readiness / load balancer). Timeout configurável: `HEALTH_READY_DB_TIMEOUT_MS` (500–15000 ms, default 3000). |
| **C** | Com `NODE_ENV=production`, `check:prod-env --strict` e `check:db` **exigem** indicação de TLS na `DATABASE_URL` (`sslmode=require`, `verify-full`, `verify-ca` ou `ssl=true`). Para Postgres **local sem TLS** em homolog: `NODE_ENV=development` nas checagens ou `ALLOW_INSECURE_DATABASE_URL=1` (nunca em produção real). |

Comandos:

```bash
npm run check:db          # só banco (usa DATABASE_URL do .env)
npm run check:readiness   # check:prod-env --strict && check:db
```

Após deploy, o orquestrador deve apontar readiness para **`GET /health/ready`** (não apenas `/health`).

---

## 4. Passo a passo operacional (deploy)

### 4.1 Antes do primeiro deploy

1. Gere `JWT_SECRET` (ex.: 64 bytes em base64 ou string aleatória longa).
2. Gere `WEBHOOK_INBOX_SECRET` (valor forte, distinto do JWT).
3. Preencha `DATABASE_URL` apontando para o **banco de produção** (não o mesmo do dev, se possível).
4. Defina `CORS_ORIGIN` se houver front SPA chamando `/v1/portal/*`.

### 4.2 No pipeline (CI/CD)

Após build, **antes** de liberar tráfego:

```bash
npm run build
npm run check:readiness
```

Ou com variáveis injetadas pelo job (recomendado): exporte `DATABASE_URL`, `JWT_SECRET`, `WEBHOOK_INBOX_SECRET`, `ENABLE_MOCK_AUTH=false`, depois:

```bash
FORCE_PROD_ENV_CHECK=1 npm run check:prod-env -- --strict
```

O script falha (`exit 1`) se alguma checagem bloqueadora não passar.

### 4.3 Após subir o processo

1. **Liveness**: `GET https://<host>/health` → `{ "status": "ok", ... }`.
2. **Readiness**: `GET https://<host>/health/ready` → **200** com `checks` (DB + schema mínimo) ou **503** se banco indisponível / TLS não indicado em produção / migrações incompletas.
3. **Mocks desligados**: `POST https://<host>/v1/auth/token/mock` com qualquer header → **404** (esperado).
4. **Webhook sem segredo** (só para sanity se alguém removeu o secret): deve retornar **503** no corpo `webhook_inbox_misconfigured`.
5. **Webhook com segredo**: `POST /v1/inbox/webhooks` com `x-tenant-id` válido (UUID público do tenant) + `X-Webhook-Secret` correto → **202** ou dedupe **200**.

### 4.4 Borda (reverse proxy / API Gateway)

- TLS terminado na borda; cabeçalhos `Authorization`, `x-tenant-id`, `x-correlation-id`, `X-Webhook-Secret` encaminhados.
- Limite de tamanho de body coerente com `express.json({ limit: "2mb" })`.
- (Futuro) rate limiting na borda para `/v1/inbox/webhooks` e rotas de auth reais.

### 4.5 Observabilidade

- Logs stdout: linhas JSON `http_access` com `correlation_id` — correlacione com o header de resposta `x-correlation-id`.
- Configure alerta para taxa de **5xx** e latência p95 nas rotas críticas (`/v1/billing/*`, `/v1/inbox/*`).

---

## 5. Checklist rápido (copiar para ticket / release)

- [ ] `NODE_ENV=production`
- [ ] `JWT_SECRET` ≥ 32 caracteres, fora do repositório
- [ ] `WEBHOOK_INBOX_SECRET` definido e igual no n8n/provedor
- [ ] `ENABLE_MOCK_AUTH=false` (explícito)
- [ ] `CORS_ORIGIN` se portal no browser
- [ ] Migrações aplicadas no BD de produção (`npm run migrate` com URL de prod)
- [ ] `npm run check:readiness` (ou `check:prod-env --strict` + `check:db`) verde no pipeline
- [ ] Smoke: `/health`, `/health/ready`, webhook com secret, uma cobrança de teste em tenant isolado

---

## 6. Referências no repositório

- Contrato de API + smoke: [API_CONTRATO_E_SMOKE.md](./API_CONTRATO_E_SMOKE.md)
- Postgres e `.env` inicial: [../SETUP_POSTGRES_E_ENV.md](../SETUP_POSTGRES_E_ENV.md)
- Script de checagem: `npm run check:prod-env` → `scripts/check-production-env.ts`
