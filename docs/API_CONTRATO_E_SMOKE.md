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
| GET | `/v1/admin/queues/status` | Bearer core + `x-tenant-id` + role **owner**; metricas BullMQ + snapshot SLI (Sprint K) |
| GET | `/v1/admin/queues/dlq/:queueName` | Idem; query `limit` (max 200); lista jobs na DLQ |
| POST | `/v1/admin/queues/dlq/:queueName/reprocess` | Idem; body `{ "jobId": "<id na DLQ>" }` |
| GET | `/v1/admin/metrics/sli` | Idem; 7 SLIs calculados em SQL |
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
| GET | `/v1/portal/fiscal/guias` | **Flag** `FISCAL_GUIAS_ENABLED=true`; Bearer portal; roles admin_escritorio / operador; query `limit`, `cursor`, filtros opcionais; resposta `{ guias[], count, page_limit, next_cursor }`; migration **`028_fiscal_guias_fase0.sql`** |
| GET | `/v1/portal/fiscal/guias/:guiaId` | Idem; detalhe `{ guia }`; **404** `guia_not_found` |
| GET | `/v1/portal/fiscal/guias/:guiaId/pdf-url` | Idem; **admin_escritorio** / **operador**; `{ pdf_url, expires_in_seconds }`; **404** `guia_not_found` ou `pdf_unavailable` |
| POST | `/v1/portal/fiscal/guias/:guiaId/pagamentos` | Idem; **admin_escritorio** apenas; body `{ valor_pago, data_pagamento, meio?, comprovante_url? }`; **201** `{ pagamento, guia_status: "PAGO" }`; **409** `guia_transition_denied` |
| POST | `/v1/portal/fiscal/certificados` | Idem; **admin_escritorio** apenas; body PEM cifrado (AES); **201** `{ certificado }` com **`certificate_vault_id`** (S2 vault); **404** `cliente_not_found` |
| GET | `/v1/portal/fiscal/certificados` | Idem; query **`portal_cliente_id`** (UUID); **200** `{ certificado }` ou `{ certificado: null }`; metadados sem PEM; leitura primária `fiscal.certificate_vault` |
| POST | `/v1/portal/fiscal/procuracoes` | Idem; **admin_escritorio** apenas; **201** `{ procuracao }` |
| GET | `/v1/portal/fiscal/procuracoes` | Idem; query **`portal_cliente_id`** (UUID); **200** `{ procuracao }` ou `{ procuracao: null }` |
| GET | `/v1/portal/fiscal/serpro-config` | Idem; **admin_escritorio** apenas; **200** `{ serpro_config }`; migration **`032_organization_and_serpro_config.sql`** + backfill org |
| PATCH | `/v1/portal/fiscal/serpro-config` | Idem; **admin_escritorio** apenas; body `ambiente?`, `contratante_cnpj`, `consumer_key?`, `consumer_secret?`, `serpro_enabled?`; credenciais AES-256-GCM (`ENCRYPTION_KEY`); **200** `{ serpro_config }` (CNPJ mascarado; flags `consumer_*_configured`) |
| GET | `/v1/portal/fiscal/audit` | Idem; **admin_escritorio** apenas; query `limit`, `cursor`, `from`, `to` (YYYY-MM-DD), `action`, `user_id`; **200** `{ entries, count, page_limit, next_cursor }`; tabela `fiscal.audit_log` |
| POST | `/v1/portal/fiscal/ingest/csv` | Idem; **admin_escritorio**; multipart campo **`file`** (CSV PGDASD v1, max 2MB); **202** `{ ingest }` status inicial `VALIDANDO`; migration **`034_fiscal_ingest.sql`** |
| GET | `/v1/portal/fiscal/ingest/:ingestId` | Idem; admin/operador; **200** `{ ingest }` status `VALIDANDO` \| `VALIDADO` \| `ERRO` + `validation_errors` + `canonical_rows` (se validado) |
| GET | `/v1/portal/fiscal/certificados/expiring` | Idem; admin/operador; **200** `{ certificados[], count }` certs com ≤30 dias |
| GET | `/v1/portal/fiscal/processamentos/:processamentoId/recibo/url` | Idem; admin/operador; **200** `{ pdf_url, expires_in_seconds }` presigned recibo |
| POST | `/v1/portal/fiscal/processamentos` | Idem; admin/operador; body `{ fiscal_ingest_id }`; ingest deve estar `VALIDADO`; **201** `{ processamentos[] }`; migration **`035_processamento_fiscal.sql`** |
| GET | `/v1/portal/fiscal/processamentos` | Idem; admin/operador; **200** `{ processamentos[] }` |
| GET | `/v1/portal/fiscal/processamentos/:processamentoId` | Idem; admin/operador; **200** `{ processamento, eventos[] }` timeline |
| POST | `/v1/exeq/auth/login` | Público (rate limit); body `email`, `password`; master EXEQ (`is_platform_master`); **200** `{ access_token, user }` |
| GET | `/v1/exeq/auth/me` | Bearer master EXEQ |
| GET | `/v1/exeq/organizations` | Bearer master; **200** `{ data[], count }` — orgs com `automacao_tenant_id` quando vinculadas |
| GET | `/v1/exeq/organizations/:organizationId` | Bearer master; **200** `{ organization }`; **404** se ausente |
| PATCH | `/v1/portal/cobrancas/:chargeId` | Idem; exige billing link; **não** altera cobrança `paga` ou `cancelada` |
| POST | `/v1/auth/token/mock` | **Mock** — `x-tenant-id` core; desligavel |
| GET | `/v1/auth/me` | Bearer + tenant core |
| GET | `/v1/auth/admin-only` | Bearer + roles owner/admin |
| POST | `/v1/billing/charges` | Bearer + roles |
| GET | `/v1/billing/charges` | Bearer + roles; itens em `charges[]` usam **camelCase** (`canonicalStatus`, `idempotencyKey`, …) |
| POST | `/v1/inbox/webhooks` | `x-tenant-id` core; em **producao** exige `WEBHOOK_INBOX_SECRET` configurado; se secret definido, header `X-Webhook-Secret`; aceita `event_type: fiscal.guia.reconciliation.requested` (Fase 2.6 — ver ADR sec. 17) |
| POST | `/v1/inbox/webhooks/process-pending` | Bearer |
| POST | `/v1/tenants/provision/mock` | **Mock** sem persistencia; JWT owner/admin; desligavel |
| POST | `/v1/tenants/provision` | **Persistido** — JWT core owner/admin; body JSON; veja secao 3; **409** se `slug` duplicado; opcional `plano_slug` / `planoSlug` (default `basico`); cria `assinaturas` em **trial** 14 dias |
| GET | `/v1/saas/plans` | Bearer core; roles **owner** / **admin**; catálogo global `{ data: planos[] }` |
| GET | `/v1/saas/metrics` | Bearer core; role **owner** apenas; `{ metrics: { mrr, currency, tenants_by_status, inadimplencia, generated_at } }` |
| GET | `/v1/portal/escritorio/assinatura` | Bearer portal + billing link; roles admin_escritorio / owner; `{ assinatura: { status, read_only, plano, uso, … } }` ou **404** sem assinatura |
| POST | `/v1/portal/escritorio/assinatura/activate` | admin_escritorio; cria assinatura recorrente no Asaas (`gateway_subscription_id`); **503** se `ASAAS_PLATFORM_API_KEY` ausente; **409** se já ativada |
| POST | `/v1/portal/certificates/validate` | **LLD-CERT-001** — Bearer portal + **admin_escritorio**; `multipart/form-data` (`certificate`, `private_key`); validação mTLS + store cifrado; **200** metadados + `certificate_id`; **422** catálogo ERR-*; rate limit **10/min/usuário**; OpenAPI: [openapi/portal-certificates-validate.yaml](./openapi/portal-certificates-validate.yaml) |

**Fiscal guias (Fase 1.2):** captura real DAS via `RECEITA_DAS_CAPTURE_URL` (mTLS certificado A1); PDF em S3 (`S3_BUCKET`, `S3_REGION`, …) ou local (`FISCAL_PDF_STORAGE=local`); notificação WhatsApp `guia.disponivel` na fila `notifications-send` (migration **`029_fiscal_guia_disponivel_template.sql`**).


**Escritório — configurações (Sprint C)** — prefixo `/v1/portal/escritorio`, **admin_escritorio** (403 outros papéis):

| Método | Caminho | Notas |
|--------|---------|--------|
| GET | `/config` | `{ config }` credenciais mascaradas (`gateway_api_key`, `whatsapp_token`) |
| PATCH | `/config` | Campos opcionais: fiscal, `gateway_provider`, `gateway_api_key`, `whatsapp_*` |
| GET | `/gateway/providers` | `{ data: providers[] }` — metadados (authType, credentialFields) |
| GET | `/gateway/providers/:provider/schema` | `{ provider }` — schema de credenciais |
| PATCH | `/gateway` | `{ gateway_provider, gateway_credentials?, gateway_api_key?, certificate_upload_id? }` — **LLD-CERT-001:** mTLS pode usar `certificate_upload_id` (UUID de `/certificates/validate`) em vez de PEM no JSON |
| GET | `/gateway/history` | `{ data: changeLog[] }` |
| GET | `/regua` | `{ data: rules[] }` |
| POST | `/regua` | `{ days_offset, channel, template_id? }` — **409** `duplicate_rule` |
| PATCH | `/regua/:ruleId` | `{ is_active?, channel? }` |
| DELETE | `/regua/:ruleId` | **204** |
| GET | `/templates` | `{ data: templates[] }` |
| PATCH | `/templates/:templateId` | `{ subject?, body_template }` — **422** `system_template_readonly` |
| GET | `/templates/:templateId/preview` | Query `charge_id` (UUID) — `{ subject, body_rendered }` |

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

### 2.2 Inbox — `POST /v1/inbox/webhooks` (idempotência, Sprint D)

Detalhe completo: [INBOX_WEBHOOK_IDEMPOTENCIA.md](./INBOX_WEBHOOK_IDEMPOTENCIA.md).

| Header / campo | Obrigatório | Notas |
|----------------|-------------|--------|
| `x-tenant-id` | Sim | Slug tenant core |
| `X-Webhook-Secret` | Se `WEBHOOK_INBOX_SECRET` definido | Em `production`, secret no servidor é obrigatório |
| `X-External-Event-Id` | Recomendado para dedup | Alternativa: `body.external_event_id` |

**Resposta** (sempre `accepted: true` em sucesso):

| Caso | HTTP | `deduplicated` | `already_processed` |
|------|------|----------------|---------------------|
| Primeira gravação | **202** | `false` | `false` |
| Reenvio (ainda na fila) | **200** | `true` | `false` |
| Reenvio (já processado) | **200** | `true` | `true` |

Corpo inclui `id` (UUID da linha em `webhook_inbox`). Unicidade: `(tenant_id, external_event_id)` — ver migration `001`.

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

### `POST /v1/portal/certificates/validate` (portal — LLD-CERT-001)

- **Papel:** apenas `admin_escritorio`.
- **Content-Type:** `multipart/form-data`
- **Campos obrigatórios:**

| Campo | Tipo | Descrição |
|--------|------|-----------|
| `certificate` | file | Certificado PEM (`.crt`, `.pem`, `.cer`); bloco `CERTIFICATE`; máx. 64 KB |
| `private_key` | file | Chave privada PEM (`.key`, `.pem`); máx. 64 KB |

- **Resposta 200:**

```json
{
  "certificate_id": "uuid",
  "subject_cn": "empresa.exemplo",
  "not_after": "2027-04-02T23:59:59.000Z",
  "days_remaining": 646,
  "warnings": [],
  "info": ["Certificado válido. Expira em …", "Par certificado/chave validado com sucesso."]
}
```

- **Resposta 422:**

```json
{
  "error_code": "ERR-007",
  "message": "A chave privada não corresponde ao certificado enviado. …",
  "field": "private_key"
}
```

- **Resposta 500:** `{ "error_code": "NET-001", "message": "…" }` (timeout 10s ou erro interno).
- **Segurança:** chave privada processada em memória; payload PEM **não** retornado ao cliente; store Redis/memória cifrado (TTL 30 min). Referência OpenAPI: [openapi/portal-certificates-validate.yaml](./openapi/portal-certificates-validate.yaml).
- **Uso com gateway:** incluir `certificate_upload_id` no body de `PATCH /v1/portal/escritorio/gateway` junto com `client_id` / `client_secret`.

### `PATCH /v1/portal/escritorio/gateway` — campo `certificate_upload_id`

```json
{
  "gateway_provider": "inter",
  "gateway_credentials": {
    "client_id": "uuid-da-app-inter",
    "client_secret": "secret"
  },
  "certificate_upload_id": "uuid-retornado-pelo-validate"
}
```

- **422** `certificate_upload_expired` se o UUID expirou ou é inválido.

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

**Runbook auth producao:** [RUNBOOK_AUTH_PRODUCAO.md](./RUNBOOK_AUTH_PRODUCAO.md) (JWT, mocks, smoke, rotacao).  
Guia deploy: [PRODUCAO_ENDURECIMENTO_PASSO_A_PASSO.md](./PRODUCAO_ENDURECIMENTO_PASSO_A_PASSO.md). Validação: `NODE_ENV=production npm run check:prod-env -- --strict`.

### 4.1 Autenticacao — rotas mock vs login real

| Ambiente | Core token | Portal token | Provision |
|----------|------------|--------------|-----------|
| Dev (`ENABLE_MOCK_AUTH` ou `NODE_ENV` ≠ production) | `POST /v1/auth/token/mock` | `POST /v1/portal/auth/token/mock` | `POST /v1/tenants/provision/mock` |
| **Producao** | **404** | **404** | **404** |
| Producao / homolog real | Fluxo core da plataforma | `POST /v1/portal/auth/login` | `POST /v1/tenants/provision` |

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
