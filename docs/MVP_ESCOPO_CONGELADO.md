# MVP Cobrança + Portal + Inbox — escopo congelado

**Status (atualizado):** **Fase 2 — desenvolvimento ativo.** A homologação formal da fase 1 **não** ocorre neste momento; o **mesmo time** avança o produto com **descongelamento controlado** do escopo (novos endpoints e UI conforme [FASE2_KICKOFF_QUALIDADE.md](./FASE2_KICKOFF_QUALIDADE.md)). O baseline da secção 1 permanece referência técnica.

**Front do portal:** SPA **Vite + React + TypeScript** em `apps/portal-web` (consumindo esta API). Ver [PORTAL_WEB.md](./PORTAL_WEB.md).  
**Fonte da verdade dos endpoints:** [API_CONTRATO_E_SMOKE.md](./API_CONTRATO_E_SMOKE.md).

**Execução (fase 1 — concluída no código; homologação adiada):** o escopo da secção 1 foi levado a bom nível técnico com **testes em micro-entregas** — `npm test`, `npm run portal:test`, `npm run test:integration` (ver secção 4 e [PORTAL_WEB_TEST_BATTERY.md](./PORTAL_WEB_TEST_BATTERY.md)).

**Execução (fase 2):** barra de qualidade reforçada — `npm run quality:gate` antes de PR; ver [FASE2_KICKOFF_QUALIDADE.md](./FASE2_KICKOFF_QUALIDADE.md).

**Carga opcional (POST clientes):** `npm run test:stress:portal-clientes` (Vitest, `RUN_PORTAL_CLIENTES_STRESS=1`, concorrência configurável via `STRESS_CONCURRENCY` / `STRESS_BATCHES`). **Script de carga:** `DATABASE_URL=… npm run test:load:portal-clientes` (métricas JSON no stdout; `LOAD_TOTAL`, `LOAD_CONCURRENCY`).

---

## 1. Baseline técnico da fase 1 (referência) + evolução na fase 2

A lista abaixo é o **núcleo já entregue** em código. Na **fase 2**, novas rotas e UI são permitidas desde que sigam [FASE2_KICKOFF_QUALIDADE.md](./FASE2_KICKOFF_QUALIDADE.md) (contrato + testes + PRs pequenos).

Inclui o que estava no MVP inicial (rotas + health):

- **Liveness / readiness:** `GET /health`, `GET /health/ready`
- **Portal (web + API):** `POST /v1/portal/auth/token/mock` (mock, desligável em prod), **`POST /v1/portal/auth/login` (auth real com senha)**, `GET/POST` em `/v1/portal/clientes`, `GET` notas-fiscais, `GET/POST` cobranças, `GET` cobranças por cliente
- **Core:** `POST/GET` mock auth core, `GET /v1/auth/me`, `GET /v1/auth/admin-only`, `POST/GET /v1/billing/charges`
- **Inbox:** `POST /v1/inbox/webhooks`, `POST /v1/inbox/webhooks/process-pending`
- **Tenants:** `POST /v1/tenants/provision/mock` (stub) e **`POST /v1/tenants/provision` (persistido, JWT owner/admin)**

**Fase 2 — expansão:** novos endpoints e telas são permitidos com **documentação** (`API_CONTRATO_E_SMOKE.md`, `PORTAL_WEB.md`) e **versionamento** quando houver breaking change.

**Atenção:** alterações breaking de contrato exigem alinhamento explícito com `apps/portal-web` e nota no contrato.

---

## 2. Portal web — alinhamento técnico com a API

1. **Base URL:** em dev, `apps/portal-web` usa proxy Vite (`/v1` → API); opcional `VITE_API_BASE_URL` para API remota. Ver [PORTAL_WEB.md](./PORTAL_WEB.md).
2. **`CORS_ORIGIN`** no `.env` da API com a origem do front (`http://localhost:5173` em dev; domínio estático ou CDN em prod) — ver `Projeto_EmissaoNF/docs/PORTAL_IMPLEMENTACAO_PASSO_A_PASSO.md` para fluxo geral BD → n8n → portal → API.
3. **Headers:** `Authorization`, `x-tenant-id`, `Content-Type`; correlacionar `x-correlation-id` quando útil.
4. **Token portal:** `POST /v1/portal/auth/login` (body `email` + `tenant_id` + `password`), alinhado à **Tela 1** do guia `Projeto_EmissaoNF/docs/PORTAL_IMPLEMENTACAO_PASSO_A_PASSO.md`. O mock `POST /v1/portal/auth/token/mock` permanece útil só em dev com `ENABLE_MOCK_AUTH`.

---

## 3. Fase 2 — prioridades A e B (homologação adiada; desenvolvimento em curso)

| Opção | Foco | Nota para o time |
|-------|------|------------------|
| **A — Autenticação real + provisionamento** | Endurecimento de `POST /v1/portal/auth/login`, `POST /v1/tenants/provision`, migrações/seed, políticas de mock em prod | PRs pequenos + testes de integração |
| **B — CRUD / relatórios do portal** | Telas e fluxos em `apps/portal-web`; novos endpoints **documentados** em `API_CONTRATO_E_SMOKE.md` antes de merge | Cada feature com teste Vitest no portal onde fizer sentido |

**Regra:** com homologação externa adiada, o time **pode intercalar** A e B em sprints curtas, desde que cada PR mantenha o **DoD** em [FASE2_KICKOFF_QUALIDADE.md](./FASE2_KICKOFF_QUALIDADE.md). Quando a homologação voltar, regista-se de novo a prioridade única para aceite com utilizadores.

---

## 4. Pipeline obrigatório antes de cada release

Na máquina local ou no CI:

```bash
npm ci
npm run build
npm test
npm run portal:test
npm run migrate          # ambiente alvo
npm run check:readiness  # variáveis + Postgres + schema mínimo
npm run test:integration # requer DATABASE_URL válido
```

Em **produção**, não depender de `ALLOW_INSECURE_DATABASE_URL`; usar `DATABASE_URL` com TLS (`sslmode=require`, etc.).

---

## 5. Referências

| Documento | Uso |
|-----------|-----|
| [FASE2_KICKOFF_QUALIDADE.md](./FASE2_KICKOFF_QUALIDADE.md) | DoD fase 2 + frentes iniciais |
| [API_CONTRATO_E_SMOKE.md](./API_CONTRATO_E_SMOKE.md) | Contrato HTTP e smoke |
| [PORTAL_WEB.md](./PORTAL_WEB.md) | SPA portal + dev/proxy |
| [PORTAL_WEB_TEST_BATTERY.md](./PORTAL_WEB_TEST_BATTERY.md) | Bateria manual + automática do portal |
| [PRODUCAO_ENDURECIMENTO_PASSO_A_PASSO.md](./PRODUCAO_ENDURECIMENTO_PASSO_A_PASSO.md) | Deploy e readiness |
| [../SETUP_POSTGRES_E_ENV.md](../SETUP_POSTGRES_E_ENV.md) | Banco e `.env` |

---

*Última atualização: transição fase 2 + kickoff qualidade + pipeline (stress no CI).*
