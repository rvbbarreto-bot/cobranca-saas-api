# Contrato HTTP, endurecimento de producao e bateria funcional

> **Evolução fase 2:** lista de rotas base + extensões; governo de produto em [MVP_ESCOPO_CONGELADO.md](./MVP_ESCOPO_CONGELADO.md) e qualidade em [FASE2_KICKOFF_QUALIDADE.md](./FASE2_KICKOFF_QUALIDADE.md) (portal em **`apps/portal-web`**).

Visao conjunta: **requisitos / sistemas / arquitetura** — o que a API expoe, como endurecer ambiente produtivo e como validar de ponta a ponta.

---

## 1. Duas superficies de tenant

| Superficie | Header tipico | Resolucao | Rotas |
|------------|---------------|-----------|--------|
| **Core SaaS** | `x-tenant-id: demo` ou UUID de `public.tenants` | `tenantResolutionMiddleware` | `/v1/auth/*`, `/v1/billing/*`, `/v1/inbox/*`, `/v1/tenants/*` |
| **Portal** | `x-tenant-id: <id ou slug de automacao.tenants>` | `portalAutomacaoTenantMiddleware` | `/v1/portal/*` (exceto token mock) |

O portal usa JWT cujo claim `tid` e **texto** (id do escritorio em `automacao`). O core usa **UUID** de `public.tenants`.

---

## 2. Inventario de rotas (prefixo real)

| Metodo | Caminho | Auth / notas |
|--------|---------|----------------|
| GET | `/health` | Publico (liveness) |
| GET | `/health/ready` | Readiness: ping Postgres + schema minimo; **503** se DB falhar ou TLS nao indicado em `NODE_ENV=production` |
| POST | `/v1/portal/auth/token/mock` | **Mock** — veja secao 3; desligavel |
| POST | `/v1/portal/auth/login` | **Auth real** — body `email`, `tenant_id`, `password`; veja secao 3; sem mock gate |
| GET | `/v1/portal/auth/me` | Bearer + portal middlewares; perfil `user` + `tenant` (fase 2) |
| GET | `/v1/portal/notas-fiscais` | Bearer + portal; query opcional `limit`, `cursor` (P1 — ver secção *Paginação GET portal*) |
| GET | `/v1/portal/cobrancas` | Idem; `limit` + `cursor` (tenant público via billing link) |
| POST | `/v1/portal/cobrancas` | Idem; exige `portal.billing_tenant_link`; body conforme `createChargeBodySchema` + opcional `portal_cliente_id` (UUID) |
| GET | `/v1/portal/clientes` | Idem; `limit` + `cursor` |
| POST | `/v1/portal/clientes` | Idem |
| PATCH | `/v1/portal/clientes/:clienteId` | Idem; retificação **sem** alterar documento (nome, email, whatsapp) |
| GET | `/v1/portal/clientes/:clienteId/cobrancas` | Idem; `limit` + `cursor` (mesmo formato que cobranças globais) |
| PATCH | `/v1/portal/cobrancas/:chargeId` | Idem; exige billing link; **não** altera cobrança `paga` ou `cancelada` |
| POST | `/v1/auth/token/mock` | **Mock** — `x-tenant-id` core; desligavel |
| GET | `/v1/auth/me` | Bearer + tenant core |
| GET | `/v1/auth/admin-only` | Bearer + roles owner/admin |
| POST | `/v1/billing/charges` | Bearer + roles |
| GET | `/v1/billing/charges` | Bearer + roles; itens em `charges[]` usam **camelCase** (`canonicalStatus`, `idempotencyKey`, …) |
| POST | `/v1/inbox/webhooks` | `x-tenant-id` core; em **producao** exige `WEBHOOK_INBOX_SECRET` configurado; se secret definido, header `X-Webhook-Secret` |
| POST | `/v1/inbox/webhooks/process-pending` | Bearer |
| POST | `/v1/tenants/provision/mock` | **Mock** sem persistencia; JWT owner/admin; desligavel |
| POST | `/v1/tenants/provision` | **Persistido** — JWT core owner/admin; body JSON; veja secao 3; **409** se `slug` duplicado; opcional `plano_slug` / `planoSlug` (default `basico`); cria `assinaturas` em **trial** 14 dias |
| GET | `/v1/saas/plans` | Bearer core; roles **owner** / **admin**; catálogo global `{ data: planos[] }` |
| GET | `/v1/saas/metrics` | Bearer core; role **owner** apenas; `{ metrics: { mrr, currency, tenants_by_status, inadimplencia, generated_at } }` |
| GET | `/v1/portal/escritorio/assinatura` | Bearer portal + billing link; roles admin_escritorio / owner; `{ assinatura: { status, read_only, plano, uso, … } }` ou **404** sem assinatura |
| POST | `/v1/portal/escritorio/assinatura/activate` | admin_escritorio; cria assinatura recorrente no Asaas (`gateway_subscription_id`); **503** se `ASAAS_PLATFORM_API_KEY` ausente; **409** se já ativada |

**Portal web (Sprint B):** em `/escritorio`, admin vê botão que chama `POST …/assinatura/activate`. Listagens `/cobrancas`, `/clientes` e `/notas-fiscais` usam `limit` (50) + **Carregar mais** via `next_cursor`.

**Metering (Sprint 4):** em `POST /v1/portal/cobrancas` e `POST /v1/portal/clientes`, o servidor pode responder:

| HTTP | `error` (corpo) | Quando |
|------|-----------------|--------|
| **403** | `SUBSCRIPTION_READ_ONLY` | Assinatura expirada / modo somente leitura |
| **402** | `LIMIT_CLIENTES` | Limite de clientes do plano atingido |
| **402** | `LIMIT_COBRANCAS_MES` | Limite mensal de cobranças atingido |

### 2.1 Paginação `GET` portal (P1 — cursor + `limit`)

Rotas: **GET** `/v1/portal/notas-fiscais`, `/v1/portal/cobrancas`, `/v1/portal/clientes`, `/v1/portal/clientes/:clienteId/cobrancas`.

| Query | Descrição |
|--------|-----------|
| `limit` | Opcional; inteiro **1–200** (default **50** no servidor). |
| `cursor` | Opcional; string opaca devolvida como `next_cursor` na resposta anterior (Base64URL de JSON interno). |

**Resposta** (além de `data` e `count` por página):

- `page_limit`: eco do limite aplicado.
- `next_cursor`: próximo cursor, ou `null` se não há mais páginas.

**Erros:** `400` com `error: "invalid_cursor"` se `cursor` estiver corrompido ou com formato inválido.

**Ordenação estável:** cobranças `created_at DESC, id DESC`; clientes `nome ASC, id ASC`; notas fiscais `created_at` (nulos como `-infinity`) **DESC** com desempate `id` **DESC** (numérico `automacao.notas_fiscais.id` exposto na view).

**Migração:** listagem de notas com cursor requer **`012_portal_nf_resumo_id_pagination.sql`** (coluna `id` em `portal.vw_notas_fiscais_resumo`). Sem ela, `GET /v1/portal/notas-fiscais` falha no SQL até correr `npm run migrate`.

---

## 3. Contratos de body (pontos que geravam confusao)

### `POST /v1/portal/auth/token/mock`

- **Content-Type:** `application/json`
- **Body obrigatorio:**

```json
{
  "email": "portal-seed@local.dev",
  "tenant_id": "1"
}
```

- `email`: deve existir em `portal.app_user`.
- `tenant_id`: **texto** igual a `portal.membership.tenant_id` (normalmente `automacao.tenants.id::text`).
- **Resposta 200:** `{ "access_token", "token_type", "expires_in" }`
- **Erros comuns:** 400 corpo invalido; 403 sem membership.

### `POST /v1/portal/auth/login` (portal — Sprint A)

- **Content-Type:** `application/json`
- **Body obrigatorio:**

```json
{
  "email": "portal-seed@local.dev",
  "tenant_id": "<id::text do automacao.tenants, igual a membership>",
  "password": "<senha do usuario em portal.app_user>"
}
```

- `password_hash` em `portal.app_user` deve estar preenchido (apos migracao `011` e seed ou fluxo de cadastro). Se ausente: **422**.
- **Resposta 200:** mesmo formato do mock: `{ "access_token", "token_type", "expires_in" }`.
- **Erros comuns:** 400 corpo invalido; 401 senha incorreta; 403 sem membership.

### `GET /v1/portal/auth/me`

- **Headers:** `Authorization: Bearer …`, `x-tenant-id` (slug ou id `automacao.tenants`).
- **Resposta 200:** `{ "user": { "id", "email", "full_name", "membership_role", "jwt_roles"[] }, "tenant": { "id", "slug" } }`.

### `POST /v1/portal/cobrancas` (portal — fase 2)

- **Papel:** apenas `admin_escritorio` ou `operador`.
- **Body JSON (minimo):** `reference`, `idempotency_key` (>=8 chars), `amount` (numero > 0), `due_date` (`YYYY-MM-DD`).
- **Opcional:** `portal_cliente_id` (UUID existente em `portal.cliente` do mesmo `tenant_id`).
- **Resposta 201 / 200:** `{ "charge": { … }, "idempotent": boolean }` (`200` se reutilizou `idempotency_key`).
- **Erros comuns:** 403 papel; 409 `billing_link_missing`; 422 validacao Zod; 404 cliente inexistente.

### `PATCH /v1/portal/clientes/:clienteId` (portal — P0 retificação)

- **Papel:** apenas `admin_escritorio` ou `operador`.
- **Body:** ao menos um de `nome`, `email` (string ou `null`), `whatsapp_opt_in` (boolean). **Não** altera `documento` nesta versão.
- **Resposta 200:** `{ "cliente": { … } }`.
- **Erros comuns:** 400 `cliente_id` inválido; 404 cliente; 422 validação.

### `PATCH /v1/portal/cobrancas/:chargeId` (portal — P0 retificação)

- **Papel:** apenas `admin_escritorio` ou `operador`.
- **Body:** ao menos um de `amount` (> 0), `due_date` (`YYYY-MM-DD`), `metadata` (objeto; merge superficial com `metadata` existente).
- **Resposta 200:** `{ "charge": { … } }` (tenant público via `billing_tenant_link`).
- **Erros comuns:** 403 papel; 409 `billing_link_missing` ou `charge_not_editable` (cobrança paga/cancelada); 404 `charge_not_found`; 422 validação.

### `POST /v1/auth/token/mock` (core)

- **Sem body.**
- **Headers:** `x-tenant-id: demo` (ou UUID publico).
- **Resposta 200:** JWT com `tid` = UUID do tenant publico.

### `POST /v1/tenants/provision/mock`

- **Sem body de negocio** (stub).
- **Headers:** `x-tenant-id` core + `Authorization: Bearer <token core com role owner ou admin>`.
- **Resposta 201:** JSON explicativo; **nao grava** linhas novas de tenant — apenas contrato para evolucao futura.

### `POST /v1/tenants/provision` (core — Sprint A)

- **Headers:** `x-tenant-id` core + `Authorization: Bearer <JWT core com role owner ou admin>`.
- **Body JSON (exemplo):**

```json
{
  "slug": "novo-escritorio",
  "name": "Nome exibido",
  "status": "trial",
  "automacao_tenant_id": "opcional — vincula portal.billing_tenant_link"
}
```

- `slug`: 2–64 caracteres, padrao `^[a-z0-9]+(?:-[a-z0-9]+)*$`.
- **Resposta 201:** tenant criado em `public.tenants`; **409** em violacao de unicidade (`slug`).

---

## 4. Variaveis de ambiente (requisitos + DevOps)

Guia completo de **producao** (deploy, pipeline, health, CORS, checklist): [PRODUCAO_ENDURECIMENTO_PASSO_A_PASSO.md](./PRODUCAO_ENDURECIMENTO_PASSO_A_PASSO.md). Validação automatizada: `npm run check:prod-env -- --strict`.

| Variavel | Papel |
|----------|--------|
| `DATABASE_URL` | Postgres da aplicacao |
| `JWT_SECRET` | Assinatura JWT; em prod usar segredo longo (>= 32 caracteres recomendado) |
| `NODE_ENV` | `production` ativa comportamentos mais restritivos |
| `ENABLE_MOCK_AUTH` | `false` desliga rotas mock explicitamente; em `production` mocks **desligados por padrao** |
| `WEBHOOK_INBOX_SECRET` | Em **producao**, **obrigatorio** para `POST /v1/inbox/webhooks` aceitar trafego; fora de prod, opcional (dev) |
| `ENABLE_HTTP_ACCESS_LOG` | `true`/`false` forca log de acesso JSON; fora de `test`, ligado por padrao |
| `WEBHOOK_PROCESS_*` | Job `npm run job:webhook-inbox` |
| `ALLOW_INSECURE_DATABASE_URL` | `1`/`true`: desliga exigencia de `sslmode`/`ssl=` nas checagens `check:prod-env` / `check:db` / `GET /health/ready` em `NODE_ENV=production` (apenas dev local). |
| `HEALTH_READY_DB_TIMEOUT_MS` | Timeout do probe em `/health/ready` (500–15000, default 3000). |
| `CHECK_DB_TIMEOUT_MS` | Timeout de conexao/query no `npm run check:db` (2000–30000, default 8000). |
| `SEED_PORTAL_PASSWORD` | (Opcional, **dev/homolog**) Senha gravada no usuario seed para `POST /v1/portal/auth/login`. Default em codigo: ver `SEED_PORTAL_DEFAULT_PASSWORD` em `seed-portal-happy-path.ts`. |

No boot em `NODE_ENV=production`, o servidor emite **avisos** no console se: mocks ainda habilitados, `JWT_SECRET` fraco/ausente, ou webhook sem segredo.

---

## 5. Seed de desenvolvimento (happy path portal)

Reduz setup manual: usuario portal, escritorio `automacao`, membership `admin_escritorio`, link billing → tenant `demo`.

```bash
npm run seed:dev
```

Requer migracoes aplicadas e `DATABASE_URL` no `.env`.

Constantes (codigo): `SEED_PORTAL_EMAIL`, `SEED_AUTOMACAO_SLUG`, `SEED_PORTAL_DEFAULT_PASSWORD` em `src/dev/seed-portal-happy-path.ts`. O seed preenche `password_hash` para login real (migracao `011_portal_app_user_password_hash.sql`).

---

## 6. Bateria funcional sistematica (automacao)

Com banco configurado:

```bash
npm run seed:dev
npm run test:functional
```

Ou em um unico fluxo de CI: definir `DATABASE_URL`, migrar, seed, `npm run test:functional`.

Os casos cobertos estao em `tests/functional/api-battery.integration.test.ts` (health, core auth, billing, inbox, tenant mock, portal com seed).

---

## 7. Observabilidade

- Cada resposta continua com header `x-correlation-id` (entrada ou gerado).
- Com log de acesso habilitado, uma linha **JSON** por requisicao: `method`, `path`, `status`, `duration_ms`, `correlation_id` — pronta para ingestao em agregador de logs.

---

## 8. Checklist manual rapido (smoke)

1. `GET /health`
2. `POST /v1/auth/token/mock` + `GET /v1/auth/me`
3. `POST/GET /v1/billing/charges`
4. `POST /v1/inbox/webhooks` (+ secret se configurado)
5. `POST /v1/portal/auth/token/mock` com body seed **ou** `POST /v1/portal/auth/login` com e-mail, `tenant_id` (= id do escritorio em texto) e senha do seed; em seguida `GET /v1/portal/cobrancas` e `GET /v1/portal/clientes`

Para portal, apos seed use `x-tenant-id: escritorio-demo` (slug) ou o `id` retornado pelo seed.
