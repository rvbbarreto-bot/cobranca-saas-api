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

- **Testes automatizados:** `schemas` (login + cobrança), `api` (login, sessão, `fetchPortalMe`, listagens com `PortalListQuery` opcional `limit`/`cursor`, `postPortalCobranca`, `patchPortalCliente`, `patchPortalCobranca`), `LoginPage` (submissão).
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
| `/cobrancas` | `GET /v1/portal/cobrancas` paginado; filtro local por status; **Carregar mais**; atalhos nova cobrança / relatórios. |
| `/cobrancas/nova` | `POST /v1/portal/cobrancas`; query opcional `?clienteId=<uuid>`. |
| `/relatorios` | Export CSV a partir da lista de cobranças (client-side). |
| `/escritorio` | Resumo tenant + estado do billing link (`GET` cobranças / `auth/me`). |
| `/ajuda/provisionamento-core` | Texto de apoio ao `POST /v1/tenants/provision` (superfície core). |
| `/clientes` | `GET /v1/portal/clientes` paginado (**Carregar mais**); `/clientes/novo` (POST); `/clientes/:id` (detalhe + cobranças). |
| `/configuracoes` | **Sprint C** — abas Gateway, Régua de cobrança, Templates (`/v1/portal/escritorio/*`). Apenas `admin_escritorio`. |

O layout autenticado (`AppShell`) chama `GET /v1/portal/auth/me` para nome e papel no cabeçalho (com fallback para dados da sessão).

## Contrato com a API

- Login: corpo `{ email, tenant_id, password }`; resposta `{ access_token, token_type, expires_in }`.
- Sessão: `localStorage` (`portal.access_token`, `portal.tenant_id`, `portal.email`).
- Lista cobranças: resposta `{ data, count, billing_link_status?, message? }`; itens em **camelCase** (`reference`, `dueDate`, `amount`, `canonicalStatus`).
- Nova cobrança: `POST /v1/portal/cobrancas` com `reference`, `idempotency_key`, `amount`, `due_date` e opcional `portal_cliente_id`.

Detalhe completo: [API_CONTRATO_E_SMOKE.md](./API_CONTRATO_E_SMOKE.md).

## Telas alinhadas ao PRD geral

Referência de fluxo e aceite: **`Projeto_EmissaoNF/docs/PORTAL_IMPLEMENTACAO_PASSO_A_PASSO.md`**.
