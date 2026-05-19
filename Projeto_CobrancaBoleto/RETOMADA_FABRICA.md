# Retomada da fábrica — SaaS Cobranças (PO + Tech Lead)

**Emissão:** Maio 2026 · **Repositório:** `cobranca-saas-api`  
**Leia isto primeiro.** Os pacotes `DEMANDA_SPRINT1/2/3` e `PROMPT_FABRICA_KICKOFF.md` permanecem como referência histórica e detalhe de tarefas; este arquivo é a **fonte da verdade operacional** para retomar o desenvolvimento.

---

## 1. Onde estamos (snapshot)

| Marco | Branch de referência | Status |
|-------|---------------------|--------|
| Fase 0 — saneamento | `main` (via PR #1) | Concluído |
| Sprint 1 — gateway + emissão | `main` | Concluído |
| Sprint 2 — notificações + régua + CRUD escritório | `main` (`b2dfd1e`) | Concluído |
| Sprint 3 — portal cliente + relatórios | `main` (PR #2/#3) | Concluído |
| **Sprint 4 — SaaS billing (fase 1)** | **`cursor/sprint4-saas-billing`** | **PR #4 — pronto para merge** (testes + UI + docs) |

**Testes na branch Sprint 4 (local):** `172` testes Vitest passando (`npm test`).

**Base `main` atual:** `55ecb9d` — inclui portal cliente, dashboard, export CSV, E2E Sprint 3.

---

## 2. Gate de entrada (obrigatório no dia 1)

```bash
git fetch origin
git checkout cursor/sprint4-saas-billing   # trabalho atual da fábrica
# ou main, se Sprint 4 já tiver sido mergeado — confira com o PO

npm ci
cp .env.example .env                       # preencher DATABASE_URL, JWT_SECRET, etc.
npm run migrate
npm run seed:dev                           # ambiente novo
npm run build
npm test                                   # meta: 172+ verdes
npm run quality:gate                       # requer DATABASE_URL + schema migrado
```

**Scripts de validação por sprint** (da raiz do repo):

| Script | Quando usar |
|--------|-------------|
| `bash Projeto_CobrancaBoleto/validacao_fase_0.sh` | Regressão de saneamento (secrets, Docker, audit) |
| `bash Projeto_CobrancaBoleto/validacao_sprint3.sh` | Portal cliente + relatórios |
| `bash Projeto_CobrancaBoleto/validacao_sprint4.sh` | SaaS billing (5 checks estruturais) |

**Demonstração E2E manual (Sprint 3):** [DEMO_SPRINT3_FLUXO_11_PASSOS.md](./DEMO_SPRINT3_FLUXO_11_PASSOS.md)

---

## 3. O que já está implementado (não refazer)

### Plataforma
- Docker + `docker-compose.yml`, rate limit Redis, Sentry opcional, `audit_log`
- Crypto AES-256-GCM (`src/platform/crypto/encrypt.ts`, `decrypt.ts`)
- Filas BullMQ: `charges:emission`, `inbox:process`, `charges:sync`, `notifications:send`

### Negócio
- **payment-gateway:** `AsaasAdapter`, factory multi-provider, emissão assíncrona
- **inbox:** dedup, 6 eventos Asaas, enfileiramento de régua e confirmação de pagamento
- **notifications:** Resend + Z-API, `notification-send.worker`, scheduler régua (07h BRT)
- **portal escritório:** CRUD config/regua/templates, dashboard, export CSV, PATCH cliente/cobrança, paginação cursor
- **portal cliente:** magic link (`cliente_access_tokens`), `/v1/portal/cliente/*`
- **Sprint 4 (branch atual):** `planos`, `assinaturas`, `tenant_usage_monthly`, metering em POST cobrança/cliente, trial no provisionamento

### Front
- SPA `apps/portal-web` (Vite + React) — ver [docs/PORTAL_WEB.md](../docs/PORTAL_WEB.md)

### Fora de escopo (não implementar neste repo)
- NFS-e / nota fiscal → projeto separado
- Motor fiscal `/internal/fiscal`

---

## 4. Trabalho imediato — Sprint 4 (fechar fase 1 e abrir PR)

**Branch:** `cursor/sprint4-saas-billing`  
**Pacote detalhado:** [DEMANDA_SPRINT4.md](./DEMANDA_SPRINT4.md)

### 4.1 Entregue nesta branch (validar, não reimplementar)

- [x] Migration `023_saas_billing_plans_subscriptions.sql`
- [x] Módulo `src/modules/saas-billing/`
- [x] `GET /v1/saas/plans` (JWT core `owner` / `admin`)
- [x] `GET /v1/portal/escritorio/assinatura`
- [x] `POST /v1/tenants/provision` com `plano_slug` / `planoSlug` + trial 14 dias
- [x] Enforcement: `assertTenantCanMutate` em POST cobrança e POST cliente
- [x] Testes unitários `assert-tenant-can-mutate` (4 casos)

### 4.2 Checklist merge PR #4 (fase 1)

| # | Item | Status |
|---|------|--------|
| 1 | Contrato HTTP (`API_CONTRATO_E_SMOKE.md`) | ✅ |
| 2 | Teste integração provision + trial | ✅ `tests/saas-billing/sprint4-billing.integration.test.ts` |
| 3 | Testes GET assinatura / plans | ✅ integração + `escritorio-assinatura-router.test.ts` |
| 4 | UI `/escritorio` — bloco assinatura | ✅ `EscritorioPage` + `fetchEscritorioAssinatura` |
| 5 | `validacao_sprint4.sh` | ✅ **6/6** (Git Bash/WSL/CI) |
| 6 | `npm run quality:gate` | Validar no CI antes do merge |
| 7 | Review PO | Demo: provision → limites → `402`/`403` |

### 4.3 Backlog Sprint 4 (PR seguinte, não bloqueia fase 1)

- **4.5** `GET /v1/saas/metrics` (MRR, inadimplência) — só owner plataforma
- **4.6** Webhooks outbound + `docs/N8N_WEBHOOKS.md` (`charge.paid`, `subscription.past_due`)
- Cobrança recorrente de assinatura via Asaas Subscriptions (spec v2 §6.2 — fase posterior)

---

## 5. Ordem de execução recomendada (próximas 2 semanas)

```
Semana A — Fechar Sprint 4 fase 1
  1. Completar itens 4.2 (tabela acima)
  2. Abrir PR → main; PO aceita com validacao_sprint4.sh + demo
  3. Atualizar README e este doc (marcar Sprint 4 mergeado)

Semana B — Sprint 4 fase 2 + preparação n8n
  4. TAREFA 4.5 métricas SaaS (se priorizado pelo PO)
  5. TAREFA 4.6 contrato n8n + testes de idempotência inbox (ver FASE2 P2)
  6. Front: fluxo upgrade de plano (mock ou manual até gateway subscription)

Contínuo — Qualidade
  - Cada PR: DoD em docs/FASE2_KICKOFF_QUALIDADE.md
  - PRs pequenos (< 400 linhas úteis quando possível)
```

---

## 6. Regras absolutas (vigentes em todas as sprints)

Copiar no contexto do agente de IA ou colar no briefing diário:

1. **Stack:** Node 20 + TS 5.7 + Express + `pg` raw + BullMQ — sem Nest/Prisma sem aprovação TL.
2. **Multi-tenant:** `tenant_id` em tabelas novas; RLS / `SET LOCAL app.tenant_id`.
3. **Secrets:** nunca no código nem no git; usar `.env.example` apenas com placeholders.
4. **Webhooks:** inbox pattern — persistir → job → 202; dedup por `external_event_id`.
5. **Estados terminais:** `paga` e `cancelada` não retrocedem.
6. **Migrations:** `db/migrations/NNN_descricao.sql`, idempotentes.
7. **Audit:** `writeAuditLog` na mesma transação das mutações críticas.
8. **Cobertura:** ≥ 82% linhas em `application/` e `domain/` (ver `vitest.config.ts`).

Detalhe histórico e exemplos de código: [PROMPT_FABRICA_KICKOFF.md](./PROMPT_FABRICA_KICKOFF.md) (seções 2–5).

---

## 7. Mapa de documentação

| Documento | Uso |
|-----------|-----|
| **Este arquivo** | Kickoff retomada, prioridades, gates |
| [DEMANDA_SPRINT4.md](./DEMANDA_SPRINT4.md) | Tarefas Sprint 4 (detalhe) |
| [DEMANDA_SPRINT3.md](./DEMANDA_SPRINT3.md) | Histórico Sprint 3 (concluído) |
| [DEMANDA_SPRINT2.md](./DEMANDA_SPRINT2.md) | Histórico Sprint 2 (concluído) |
| [docs/API_CONTRATO_E_SMOKE.md](../docs/API_CONTRATO_E_SMOKE.md) | Contrato HTTP + smoke |
| [docs/FASE2_KICKOFF_QUALIDADE.md](../docs/FASE2_KICKOFF_QUALIDADE.md) | DoD por PR |
| [docs/MVP_ESCOPO_CONGELADO.md](../docs/MVP_ESCOPO_CONGELADO.md) | Escopo produto |
| [SETUP_POSTGRES_E_ENV.md](../SETUP_POSTGRES_E_ENV.md) | Banco e variáveis |
| [docs/ASAAS_SANDBOX_E2E.md](../docs/ASAAS_SANDBOX_E2E.md) | E2E gateway sandbox |

---

## 8. SYSTEM PROMPT (colar no Cursor antes de codar)

```
Você trabalha no repositório cobranca-saas-api (SaaS cobranças Boleto/PIX, multi-tenant BR).

ESTADO (Maio 2026):
- main: Sprints 0–3 concluídos (gateway, notificações, portal escritório + cliente).
- Branch ativa: cursor/sprint4-saas-billing — planos, assinaturas, metering, trial no provision.
- 172+ testes Vitest; quality:gate exige DATABASE_URL migrado.

ANTES DE CODAR:
1. Ler Projeto_CobrancaBoleto/RETOMADA_FABRICA.md
2. Confirmar branch e sprint com o PO
3. Não reimplementar itens marcados como concluídos na secção 3 do RETOMADA_FABRICA

PRÓXIMA ENTREGA: fechar Sprint 4 fase 1 (contrato API, testes integração provision, UI assinatura, PR merge).

Regras: multi-tenant, audit_log, inbox pattern, sem NFS-e, sem secrets no código.
Stack imutável: Node 20, Express, pg, BullMQ.
```

---

## 9. Ritual PO + Tech Lead (30 min, início de sprint)

1. Confirmar branch base (`main` vs `cursor/sprint4-saas-billing`).
2. Validar gates: `npm test`, script de validação do sprint, CI no GitHub.
3. Priorizar **uma** linha da tabela 4.2 ou backlog 4.3.
4. Atualizar secção 4 deste documento com data e responsável.

---

*Mantido por PO + Tech Lead. Atualizar após merge de cada sprint.*
