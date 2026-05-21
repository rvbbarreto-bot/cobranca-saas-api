# Retomada da fábrica — SaaS Cobranças (PO + Tech Lead)

**Emissão:** Maio 2026 · **Repositório:** `cobranca-saas-api`  
**Leia isto primeiro.** Pacotes históricos (`DEMANDA_SPRINT*`, `PROMPT_FABRICA_KICKOFF.md`) são referência; operação diária usa **este arquivo** + [PROMPT_FABRICA_ATUALIZACAO_MAIO2026.md](./PROMPT_FABRICA_ATUALIZACAO_MAIO2026.md).

---

## 1. Onde estamos (snapshot)

| Marco | Branch / commit | Status |
|-------|-----------------|--------|
| Fase 0 — saneamento | `main` (PR #1) | Concluído |
| Sprint 1 — gateway + emissão | `main` | Concluído |
| Sprint 2 — notificações + régua + CRUD escritório (API) | `main` | Concluído |
| Sprint 3 — portal cliente + relatórios | `main` (PR #2/#3) | Concluído |
| Sprint 4 — SaaS billing + MRR + n8n outbound | `main` (`409c69c`) | Concluído (PR #4) |
| **Sprint 4.7 — Asaas Subscriptions** | **`main`** (`aa720d3`) | Concluído (PR #5) |
| **Sprint B — portal activate + paginação** | **`main`** (`36f3a42`) | **Concluído** (PR #6) |
| **Sprint C — `/configuracoes`** | **`feat/sprint-c-portal-configuracoes`** | **PR aberto** — aguarda merge TL |

**Testes unitários (local):** `185+` Vitest (`npm test`) + `24` portal (`npm run portal:test`).

**Branch de trabalho da fábrica:** `main` (após `git pull`). Sprint B/C em branches curtas `feat/*` se necessário.

---

## 2. Gate de entrada (obrigatório no dia 1)

```bash
git fetch origin
git checkout main && git pull origin main

npm ci
cp .env.example .env                       # DATABASE_URL, JWT_SECRET, ENCRYPTION_KEY, etc.
npm run migrate
npm run seed:dev                           # ambiente novo
npm run build
npm test                                   # meta: 185+ verdes
npm run portal:test                        # meta: 22+ verdes
npm run quality:gate                       # requer DATABASE_URL + schema migrado
```

**Scripts de validação por sprint** (da raiz do repo):

| Script | Quando usar |
|--------|-------------|
| `bash Projeto_CobrancaBoleto/validacao_fase_0.sh` | Regressão de saneamento |
| `bash Projeto_CobrancaBoleto/validacao_sprint3.sh` | Portal cliente + relatórios |
| `bash Projeto_CobrancaBoleto/validacao_sprint4.sh` | SaaS billing (6 checks) |

**Demonstração E2E manual (Sprint 3):** [DEMO_SPRINT3_FLUXO_11_PASSOS.md](./DEMO_SPRINT3_FLUXO_11_PASSOS.md)

---

## 3. O que já está implementado (não refazer)

### Plataforma
- Docker + `docker-compose.yml`, rate limit Redis, Sentry opcional, `audit_log`
- Crypto AES-256-GCM (`src/platform/crypto/`)
- Filas BullMQ: `charges:emission`, `inbox:process`, `charges:sync`, `notifications:send`

### Negócio (API)
- **payment-gateway:** `AsaasAdapter`, emissão assíncrona
- **inbox:** dedup, 6 eventos Asaas, régua, confirmação de pagamento
- **notifications:** Resend + Z-API, scheduler régua (07h BRT)
- **portal escritório:** config/regua/templates, dashboard, export CSV, PATCH cliente/cobrança, paginação cursor
- **portal cliente:** magic link, `/v1/portal/cliente/*`
- **saas-billing:** planos, assinaturas, metering, trial, `GET /v1/saas/metrics`, outbound n8n
- **Sprint 4.7:** `POST /v1/portal/escritorio/assinatura/activate`, migration `024`, webhooks subscription → `assinaturas`, `subscription.past_due`

### Front (`apps/portal-web`)
- Login, dashboard KPIs, cobranças/clientes/NFs, relatórios CSV, portal cliente, bloco plano/assinatura em `/escritorio`
- **Pendente no front:** botão activate assinatura, paginação “Carregar mais”, tela `/configuracoes` real

### Fora de escopo
- NFS-e / nota fiscal → projeto separado
- Motor fiscal `/internal/fiscal`

---

## 4. Trabalho imediato (pós PR #5)

**Briefing completo:** [PROMPT_FABRICA_ATUALIZACAO_MAIO2026.md](./PROMPT_FABRICA_ATUALIZACAO_MAIO2026.md)

### 4.1 Sprint A — Fechar aceite PR #5 (se ainda pendente no PO)

| # | Item | Status |
|---|------|--------|
| 1 | Merge PR #5 em `main` | ✅ `aa720d3` |
| 2 | `npm test` + `npm run portal:test` | ✅ 185 + 22 (validar no CI) |
| 3 | `validacao_sprint4.sh` 6/6 | Validar local/CI |
| 4 | `npm run quality:gate` | Validar com `DATABASE_URL` |
| 5 | Smoke sandbox Asaas (activate + GET assinatura) | PO / TL |
| 6 | Demo PO: trial → activate → `gateway_subscription_id` | Pendente aceite |

### 4.2 Sprint B — Portal ✅ (PR #6 → `main` `36f3a42`)

- [x] UI `POST .../assinatura/activate` + paginação `next_cursor`
- [x] Merge PR #6

### 4.3 Sprint C — Configurações escritório (entregue na branch)

**Pacote:** [DEMANDA_SPRINT_C_PORTAL_CONFIGURACOES.md](./DEMANDA_SPRINT_C_PORTAL_CONFIGURACOES.md)  
**Branch:** `feat/sprint-c-portal-configuracoes`

- [x] C.1 — funções API no `apps/portal-web/src/lib/api.ts`
- [x] C.2 — página `/configuracoes` (gateway + régua + templates)
- [x] C.3 — testes Vitest portal (`ConfiguracoesPage.test.tsx`)
- [x] C.4 — `escritorio-config-router.test.ts` (5 casos)
- [x] C.5 — contrato HTTP + PR + handoff Tech Lead

### 4.4 Sprint D — Qualidade / produção (contínuo)

- [ ] FASE2 P2: idempotência inbox (carga leve)
- [ ] Evidências `SPRINT1_ACEITE_CHECKLIST.md` (`e2e:asaas:evidence`)
- [ ] `DEPLOY_CHECKLIST.md` + mocks desligados em prod

---

## 5. Ordem de execução (próximas 2 semanas)

```
Semana 1 — Aceite + Sprint B
  1. git pull main; quality:gate + validacao_sprint4.sh
  2. Aceite PO PR #5 (smoke Asaas sandbox)
  3. PR feat: portal activate + paginação cursor

Semana 2 — Sprint C (configurações) ← ATUAL
  4. Executar DEMANDA_SPRINT_C_PORTAL_CONFIGURACOES.md
  5. PR → handoff Tech Lead (não merge pela IA)

Contínuo
  - DoD: docs/FASE2_KICKOFF_QUALIDADE.md
  - PRs pequenos (< 400 linhas úteis)
```

---

## 6. Regras absolutas

1. **Stack:** Node 20 + TS 5.7 + Express + `pg` raw + BullMQ.
2. **Multi-tenant:** `tenant_id` + RLS / `SET LOCAL app.tenant_id`.
3. **Secrets:** nunca no código nem no git.
4. **Webhooks:** inbox pattern; dedup `external_event_id`.
5. **Estados terminais:** `paga` e `cancelada` não retrocedem.
6. **Migrations:** `db/migrations/NNN_descricao.sql`, idempotentes.
7. **Audit:** `writeAuditLog` na mesma transação das mutações críticas.
8. **Cobertura:** ≥ 82% em `application/`/`domain/` (`vitest.config.ts`).

---

## 7. Mapa de documentação

| Documento | Uso |
|-----------|-----|
| **Este arquivo** | Snapshot, gates, prioridades |
| [PROMPT_FABRICA_ATUALIZACAO_MAIO2026.md](./PROMPT_FABRICA_ATUALIZACAO_MAIO2026.md) | Briefing para colar no Cursor / fábrica |
| [DEMANDA_SPRINT4_ASAAS_SUBSCRIPTIONS.md](./DEMANDA_SPRINT4_ASAAS_SUBSCRIPTIONS.md) | Detalhe Sprint 4.7 |
| [docs/API_CONTRATO_E_SMOKE.md](../docs/API_CONTRATO_E_SMOKE.md) | Contrato HTTP |
| [docs/FASE2_KICKOFF_QUALIDADE.md](../docs/FASE2_KICKOFF_QUALIDADE.md) | DoD por PR |
| [docs/N8N_WEBHOOKS.md](../docs/N8N_WEBHOOKS.md) | Outbound n8n |
| [docs/ASAAS_SANDBOX_E2E.md](../docs/ASAAS_SANDBOX_E2E.md) | Smoke gateway |

---

## 8. SYSTEM PROMPT (colar no Cursor antes de codar)

```
Repositório: cobranca-saas-api (SaaS cobranças Boleto/PIX, multi-tenant BR).

ESTADO (Maio 2026):
- main (36f3a42): até Sprint B mergeado (PR #6).
- Próxima entrega: Sprint C — DEMANDA_SPRINT_C_PORTAL_CONFIGURACOES.md

ANTES DE CODAR:
1. Ler DEMANDA_SPRINT_C + RETOMADA_FABRICA + GOVERNANCA_FABRICA_COMMIT_PR.md
2. git checkout main && git pull && feat/sprint-c-portal-configuracoes
3. API escritório config/regua/templates já existe — só portal + testes router

PRÓXIMA ENTREGA: Sprint C. Após PR: handoff Tech Lead (IA não faz merge).

Regras: multi-tenant, audit_log, inbox pattern, sem NFS-e, sem secrets no código.
Governança: IA só abre PR — Tech Lead aprova e mergeia (GOVERNANCA_FABRICA_COMMIT_PR.md).
Stack: Node 20, Express, pg, BullMQ.
```

---

## 9. Ritual PO + Tech Lead (30 min)

1. Confirmar `main` atualizado (`git pull`).
2. Gates: `npm test`, `portal:test`, CI GitHub, `validacao_sprint4.sh`.
3. Priorizar **uma** linha da tabela 4.2 (Sprint B ou C).
4. Atualizar secção 4 com data e responsável.

## 10. Autorização PO — IA abre PR, Tech Lead aprova

| Ator | Ação |
|------|------|
| **IA (fábrica)** | Commit + push + **abrir PR** + **handoff** ao Tech Lead (template no doc de governança) |
| **IA** | **Proibido:** merge em `main`, `gh pr merge`, auto-approve |
| **Tech Lead** | Revisar PR, CI, código → **approve + merge** |
| **PO** | Aceite produto (demo) em P0/P1 |

Checklist G1–G7: [GOVERNANCA_FABRICA_COMMIT_PR.md](./GOVERNANCA_FABRICA_COMMIT_PR.md).

---

*Atualizado após merge PR #5 (Sprint 4.7). Próxima atualização: após Sprint B merge.*
