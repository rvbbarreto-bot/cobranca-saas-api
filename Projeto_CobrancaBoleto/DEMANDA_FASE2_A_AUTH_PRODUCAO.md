# Pacote de demandas — FASE2 A: Auth produção + runbook JWT/mock

**Emitido por:** Tech Lead · **Para:** Fábrica (IA + dev)  
**Data:** Maio 2026 · **Prioridade:** P1 (pré-release produção)  
**Branch sugerida:** `feat/fase2-a-auth-producao`

---

## Gate de entrada

```bash
git fetch origin && git checkout main && git pull origin main
# Se G/H ainda nao estiverem em main: integrar feat/sprint1-payment-emission-portal antes (cf6b334).
git checkout -b feat/fase2-a-auth-producao
npm ci && npm run migrate && npm run seed:dev
npm run build && npm test && npm run portal:test && npm run quality:gate
```

**Governança:** [GOVERNANCA_FABRICA_COMMIT_PR.md](./GOVERNANCA_FABRICA_COMMIT_PR.md) — IA abre PR + handoff; **Tech Lead** faz merge.

**Pré-requisitos de produto:** Sprints B–H entregues (portal, inbox, n8n, homolog E2E instrumentada). Homolog PO do checklist Asaas pode correr **em paralelo**; FASE2 A não depende do JSON de evidência no git.

---

## Contexto

A API já endurece auth em produção via código:

| Mecanismo | Onde |
|-----------|------|
| Mocks desligados em `NODE_ENV=production` | `src/platform/config/runtime-flags.ts` |
| Gate 404 nas rotas mock | `src/platform/http/middleware/mock-auth-routes-gate.ts` |
| Validação pré-deploy | `scripts/check-production-env.ts` (`npm run check:prod-env`) |
| Avisos no boot | `src/dev/log-production-warnings.ts` |
| Guia legado | `docs/PRODUCAO_ENDURECIMENTO_PASSO_A_PASSO.md`, `docs/DEPLOY_CHECKLIST.md` |

**Login real do portal:** `POST /v1/portal/auth/login` (email + `tenant_id` + password).  
**Rotas mock (dev apenas):** `POST /v1/auth/token/mock`, `POST /v1/portal/auth/token/mock`, `POST /v1/tenants/provision/mock`.

**Objetivo FASE2 A:** um **runbook único** operacional, validações automáticas que impedem placeholders fracos, e testes de regressão que provem mocks bloqueados — sem novo provedor de identidade.

**Fora de escopo:** OAuth/OIDC, Keycloak, rotação automática de secrets no cluster, alterar modelo de papéis JWT, NFS-e.

---

## Entregas (checklist)

### A.1 — Runbook consolidado

| Arquivo | Ação |
|---------|------|
| `docs/RUNBOOK_AUTH_PRODUCAO.md` | **Novo** — fonte única para ops/TL |

Conteúdo mínimo:

1. **Variáveis obrigatórias** (`JWT_SECRET`, `WEBHOOK_INBOX_SECRET`, `ENABLE_MOCK_AUTH=false`, `CORS_ORIGIN`, `DATABASE_URL` TLS).
2. **Comandos de verificação** antes do deploy:
   ```bash
   NODE_ENV=production ENABLE_MOCK_AUTH=false npm run check:prod-env -- --strict
   npm run check:readiness
   ```
3. **Smoke pós-deploy** (curl ou Postman):
   - `POST /v1/auth/token/mock` → **404**
   - `POST /v1/portal/auth/token/mock` → **404**
   - `POST /v1/tenants/provision/mock` → **404**
   - `POST /v1/portal/auth/login` com credencial seed/homolog → **200** + token
4. **Rotação de `JWT_SECRET`** (procedimento manual):
   - Gerar novo secret (≥ 32 chars, recomendado 64+ aleatório).
   - Janela de manutenção: todos os tokens antigos invalidam imediatamente.
   - Ordem: atualizar secret no cofre → redeploy API → comunicar re-login no portal.
   - **Não** commitar valores; registrar data/rotação no ticket de change.
5. Links para `DEPLOY_CHECKLIST.md`, `PRODUCAO_ENDURECIMENTO_PASSO_A_PASSO.md`, `API_CONTRATO_E_SMOKE.md`.

Atualizar `DEPLOY_CHECKLIST.md` e `PRODUCAO_ENDURECIMENTO_PASSO_A_PASSO.md` com link para o runbook (evitar duplicar texto longo).

---

### A.2 — Endurecer `check:prod-env`

| Arquivo | Ação |
|---------|------|
| `scripts/check-production-env.ts` | Rejeitar placeholders fracos em `--strict` |
| `src/platform/config/jwt-secret-policy.ts` | **Novo** (opcional) — funções puras testáveis |

Regras sugeridas para `JWT_SECRET` inválido em strict:

- Comprimento &lt; 32 (já existe).
- Contém `TROCAR`, `change-me`, `your-secret`, `example`, `minimo_32` (case insensitive).
- Igual a valores documentados em `.env.example` como placeholder.

Mensagem de erro clara: `JWT_SECRET parece placeholder de exemplo — gere secret forte`.

---

### A.3 — Testes unitários (política JWT)

| Arquivo | Casos |
|---------|--------|
| `tests/platform/jwt-secret-policy.test.ts` | Aceita secret forte; rejeita placeholders; borda 32 chars |

---

### A.4 — Testes de integração / funcionais (mocks bloqueados)

| Arquivo | Casos |
|---------|--------|
| `tests/functional/production-mock-auth-gate.integration.test.ts` | **Novo** |

Cenário (sem depender de Postgres se possível — preferir subir `createApp()` com env):

1. `NODE_ENV=production`, `ENABLE_MOCK_AUTH=false`, `JWT_SECRET` válido (32+).
2. `POST /v1/auth/token/mock` + header `x-tenant-id: demo` → **404** + `error: not_found`.
3. `POST /v1/portal/auth/token/mock` → **404**.
4. `POST /v1/tenants/provision/mock` → **404**.

Complemento opcional na bateria `api-battery.integration.test.ts`:

- **A7** — mesmo trio de mocks → 404 quando `process.env.NODE_ENV` for forçado a `production` no `beforeAll` do describe (isolado; não quebrar testes que usam mock em dev).

**Nota:** `tests/setup/vitest-setup.ts` liga `ENABLE_MOCK_AUTH=true` — o teste A7 deve **sobrescrever** env só dentro do describe de produção.

---

### A.5 — Contrato e portal

| Arquivo | Ação |
|---------|------|
| `docs/API_CONTRATO_E_SMOKE.md` | Secção env: referenciar `RUNBOOK_AUTH_PRODUCAO.md`; tabela rotas mock vs login real |
| `apps/portal-web/src/pages/AjudaProvisionamentoCorePage.tsx` | Link para runbook (1 parágrafo) |
| `docs/PORTAL_WEB.md` | Nota: em produção só `POST /v1/portal/auth/login` |

---

### A.6 — CI (opcional, se &lt; 15 linhas no workflow)

| Arquivo | Ação |
|---------|------|
| `.github/workflows/ci.yml` | Step após build: `NODE_ENV=production FORCE_PROD_ENV_CHECK=1 npm run check:prod-env -- --strict` usando secrets já definidos no job |

Não exigir `sslmode` na URL do Postgres do serviço CI (manter `NODE_ENV=development` no job principal; só o step de check usa `production` + `FORCE_PROD_ENV_CHECK` se necessário — alinhar com `shouldEnforceDatabaseTlsInChecks`).

---

### A.7 — PR + handoff

- `npm run quality:gate` verde.
- PR com Summary, Test plan, link `RUNBOOK_AUTH_PRODUCAO.md`.
- **Sem merge** (Tech Lead).

---

## Critérios de aceite

- [ ] Runbook revisável por ops sem ler código.
- [ ] `check:prod-env --strict` falha com JWT placeholder do `.env.example`.
- [ ] Testes A7 / `production-mock-auth-gate` verdes.
- [ ] Documentação cruzada (deploy + contrato + portal) aponta para o runbook.
- [ ] Nenhum secret real no repositório.

---

## Test plan (para o PR)

```text
[ ] npm run build
[ ] npm test
[ ] npm run portal:test
[ ] npm run quality:gate
[ ] NODE_ENV=production ENABLE_MOCK_AUTH=false JWT_SECRET=<40chars> WEBHOOK_INBOX_SECRET=<32+> npm run check:prod-env -- --strict  → exit 0
[ ] JWT_SECRET=TROCAR_... npm run check:prod-env -- --strict  → exit 1
[ ] npx vitest run tests/functional/production-mock-auth-gate.integration.test.ts
```

---

## Backlog pós–FASE2 A

| Item | Tema |
|------|------|
| CI `workflow_dispatch` Asaas E2E | Secrets GitHub |
| Botões “Carregar mais” refinados no portal | UX |
| Consolidar `main` ← branch integração sprint1 | Release TL |

---

## Referências técnicas

```text
src/platform/config/runtime-flags.ts       → isMockAuthRoutesEnabled()
src/platform/http/middleware/mock-auth-routes-gate.ts
scripts/check-production-env.ts
tests/platform/runtime-flags.test.ts       → estender se necessário
docs/FASE2_KICKOFF_QUALIDADE.md            → frente A parcial
```
