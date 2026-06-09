# Portal web (Vite + React + TypeScript)

O front do portal vive em **`apps/portal-web`** (SPA **fase 2**), consumindo a API **`cobranca-saas-api`** (`/v1/portal/*`).

## Desenvolvimento local

1. API: na raiz do repo, `npm run dev` (porta **3333** por omissão).
2. Portal: `npm run portal:dev` (porta **5173**).
3. O Vite faz **proxy** de `/v1` → `http://localhost:3333`, evitando CORS em dev **desde que** `VITE_API_BASE_URL` esteja **vazio** (padrão).

Em **`.env` da API**, inclua o origin do portal em produção ou quando usar URL absoluta no front:

```env
CORS_ORIGIN=http://localhost:5173
```

## Build e testes

```bash
npm run portal:build
npm run portal:test
```

- **Testes automatizados:** `schemas` (login + cobrança + edição), `api` (… `patchPortalCobranca`), `CobrancaEditPage`, `LoginPage`, etc.
- **E2E Robot Framework:** `tests/robot/` — navegação, validações e RBAC no browser (`npm run test:robot:setup` + `npm run test:robot`). Ver [tests/robot/README.md](../tests/robot/README.md).
- **E2E Playwright:** `e2e/` — fluxos integrados API+portal (`npm run e2e:playwright`).
- **Teste manual (bateria):** ver [PORTAL_WEB_TEST_BATTERY.md](./PORTAL_WEB_TEST_BATTERY.md).

## Variável `VITE_API_BASE_URL`

| Valor | Comportamento |
|--------|----------------|
| *(vazio)* | Pedidos relativos `/v1/...` → proxy Vite em `npm run portal:dev`. |
| `https://…` | API remota (ex.: túnel); exige **CORS** na API com `http://localhost:5173` ou o origin do host estático. |

Ver `apps/portal-web/.env.example`.

## Rotas da SPA

| Rota | Descrição |
|------|-----------|
| `/login` | E-mail, `tenant_id`, senha → `POST /v1/portal/auth/login`. |
| `/escritorio` | Perfil do tenant, **plano/assinatura** (`GET /v1/portal/escritorio/assinatura`), botão **Ativar cobrança recorrente** (`POST …/assinatura/activate`, admin), ligação billing. |
| `/` e `*` | Redireciona para `/dashboard` se autenticado, senão `/login`. |
| `/dashboard` | Atalhos (área autenticada). |
| `/notas-fiscais` | `GET /v1/portal/notas-fiscais` com **Carregar mais** (`limit` + `cursor`). |
| `/guias-fiscais` | **Fase 2.4** — `GET /v1/portal/fiscal/guias` com filtros **tipo** (Todos/DAS/DARF) e **competência** (`YYYY-MM`); badges legíveis; flag `VITE_FISCAL_GUIAS_ENABLED`. |
| `/guias-fiscais/:guiaId` | Detalhe com cabeçalho visual DAS vs DARF; **Baixar PDF**; **Registrar pagamento** (admin). |
| `/configuracoes/fiscal` | **Admin** — certificado A1 + procuração (`POST /v1/portal/fiscal/certificados`, `/procuracoes`); aba status homolog. Flag `VITE_FISCAL_GUIAS_ENABLED`. |
| `/cobrancas` | `GET /v1/portal/cobrancas` paginado; filtro local por status; **Carregar mais**; atalhos nova cobrança / relatórios. |
| `/cobrancas/nova` | `POST /v1/portal/cobrancas`; query opcional `?clienteId=<uuid>`. |
| `/cobrancas/:chargeId` | Detalhe do boleto + painel PIX/boleto. |
| `/cobrancas/:chargeId/editar` | **Sprint F** — `PATCH /v1/portal/cobrancas/:id` (valor, vencimento); oculto se `paga`/`cancelada`. |
| `/clientes/:id/editar` | `PATCH /v1/portal/clientes/:id` (nome, e-mail, opt-in). |
| `/relatorios` | Export CSV a partir da lista de cobranças (client-side). |
| `/escritorio` | Resumo tenant + estado do billing link (`GET` cobranças / `auth/me`). |
| `/ajuda/provisionamento-core` | Texto de apoio ao `POST /v1/tenants/provision` (superfície core). |
| `/clientes` | `GET /v1/portal/clientes` paginado (**Carregar mais**); `/clientes/novo` (POST); `/clientes/:id` (detalhe + cobranças). |
| `/configuracoes` | **Sprint C** — abas Gateway, Régua de cobrança, Templates (`/v1/portal/escritorio/*`). Apenas `admin_escritorio`. Gateway mTLS (Inter/Cora/C6): **upload de certificado + chave** com validação automática (LLD-CERT-001); ver secção abaixo. |

O layout autenticado (`AppShell`) chama `GET /v1/portal/auth/me` para nome e papel no cabeçalho (com fallback para dados da sessão).

## Contrato com a API

- **Producao:** autenticacao apenas via `POST /v1/portal/auth/login` (email + `tenant_id` + password). Rotas `/auth/token/mock` estao desligadas na API — ver [RUNBOOK_AUTH_PRODUCAO.md](../docs/RUNBOOK_AUTH_PRODUCAO.md).
- Login: corpo `{ email, tenant_id, password }`; resposta `{ access_token, token_type, expires_in }`.
- Sessão: `localStorage` (`portal.access_token`, `portal.tenant_id`, `portal.email`).
- Lista cobranças: resposta `{ data, count, billing_link_status?, message? }`; itens em **camelCase** (`reference`, `dueDate`, `amount`, `canonicalStatus`).
- Nova cobrança: `POST /v1/portal/cobrancas` com `reference`, `idempotency_key`, `amount`, `due_date` e opcional `portal_cliente_id`.
- **Upload certificado gateway (mTLS):** `POST /v1/portal/certificates/validate` (multipart); resposta `{ certificate_id, subject_cn, not_after, … }`; o PATCH do gateway envia `certificate_upload_id` (UUID) — **nunca** PEM no JSON final. Ver [LLD-CERT-001](./LLD-CERT-001_Upload_Certificados_PEM_v1.md) e OpenAPI em [openapi/portal-certificates-validate.yaml](./openapi/portal-certificates-validate.yaml).

Detalhe completo: [API_CONTRATO_E_SMOKE.md](./API_CONTRATO_E_SMOKE.md).

## Gateway mTLS — upload de certificados (LLD-CERT-001)

Fluxo na aba **Gateway e integrações** (`/configuracoes`) quando o provider exige mTLS (Inter, Cora, C6):

1. Selecionar gateway (ex.: **Banco Inter**).
2. Preencher **Client ID** e **Client Secret**.
3. Enviar **certificado digital** (`.crt`, `.pem`, `.cer`) e **chave privada** (`.key`, `.pem`) nos dois componentes de upload (drag-and-drop ou clique).
4. Validação local imediata (formato PEM, extensão, tamanho ≤ 64 KB); em seguida `POST /v1/portal/certificates/validate` com ambos os arquivos.
5. Em sucesso: mensagens INFO-001/002 e botão **Guardar** liberado. Em erro: catálogo ERR-* (ex.: par inválido ERR-007).
6. Ao guardar: `PATCH /v1/portal/escritorio/gateway` com `certificate_upload_id` + credenciais OAuth — o PEM **não** trafega no PATCH.

| Etapa | Endpoint | Notas |
|--------|----------|--------|
| Validar par | `POST /v1/portal/certificates/validate` | `multipart/form-data`: `certificate`, `private_key`; rate limit 10/min/usuário |
| Persistir gateway | `PATCH /v1/portal/escritorio/gateway` | Body inclui `certificate_upload_id` (UUID, TTL 30 min no store Redis) |

Homolog Inter: [QA_HOMOLOG_INTER_GATEWAY_PORTAL.md](./QA_HOMOLOG_INTER_GATEWAY_PORTAL.md) (secção upload atualizada).

## Telas alinhadas ao PRD geral

Referência de fluxo e aceite: **`Projeto_EmissaoNF/docs/PORTAL_IMPLEMENTACAO_PASSO_A_PASSO.md`**.
