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
| Sprint 3 — portal cliente + relatórios | `main` | Concluído |
| Sprint 4 — SaaS billing + MRR + n8n outbound | `main` | Concluído |
| Sprint 4.7 — Asaas Subscriptions | `main` (PR #5) | Concluído |
| Sprint B — portal activate + paginação | `main` (PR #6) | Concluído |
| Sprint C — `/configuracoes` | `main` (PR #8) | Concluído |
| **Sprint D — inbox + qualidade** | **`main`** (`1f4c328`, PR #9) | **Concluído** |

**Testes (local/CI):** `npm test` → 194+ · `npm run portal:test` → 29 · `npm run quality:gate` com Postgres.

**Branch de trabalho da fábrica:** `feat/sprint-e-n8n-orquestracao` a partir de `main` atualizado.

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
npm test                                   # meta: 194+ verdes
npm run portal:test                        # meta: 29 verdes
npm run quality:gate                       # requer DATABASE_URL + schema migrado
```

**Scripts de validação** (Linux/macOS ou WSL):

| Script | Quando usar |
|--------|-------------|
| `bash Projeto_CobrancaBoleto/validacao_fase_0.sh` | Regressão saneamento |
| `bash Projeto_CobrancaBoleto/validacao_sprint3.sh` | Portal cliente + relatórios |
| `bash Projeto_CobrancaBoleto/validacao_sprint4.sh` | SaaS billing (6 checks) |

---

## 3. O que já está implementado (não refazer)

### Plataforma
- Docker, rate limit (eager + `VITEST` noop), Sentry opcional, `audit_log`, crypto AES-256-GCM
- Filas BullMQ: `charges-emission`, `inbox-process`, `charges-sync`, `notifications-send`

### Negócio (API)
- **payment-gateway:** Asaas, emissão assíncrona
- **inbox:** dedup documentado, 6 eventos Asaas, process-pending
- **notifications:** Resend + Z-API, régua diária 07h, templates
- **portal:** config/regua/templates, dashboard, export CSV, PATCH, cursor, magic link cliente
- **saas-billing:** planos, assinaturas, metering, metrics, activate subscription (024)
- **n8n outbound (parcial):** `charge.paid`, `subscription.past_due` — Sprint E estende

### Front (`apps/portal-web`)
- Login, dashboard, cobranças/clientes/NFs, relatórios, portal cliente, `/escritorio`, `/configuracoes`, activate + Carregar mais

### Fora de escopo
- NFS-e / nota fiscal
- Motor fiscal `/internal/fiscal`

---

## 4. Trabalho imediato

**Briefing:** [PROMPT_FABRICA_ATUALIZACAO_MAIO2026.md](./PROMPT_FABRICA_ATUALIZACAO_MAIO2026.md)  
**Pacote ativo:** [DEMANDA_SPRINT_E_N8N_ORQUESTRACAO.md](./DEMANDA_SPRINT_E_N8N_ORQUESTRACAO.md)

### 4.1–4.4 Sprints B / C / D — concluídas

Ver histórico nos arquivos `DEMANDA_SPRINT_*` e PRs #6, #8, #9.

### 4.5 Sprint E — Orquestração n8n (P3) ← **ATUAL**

| # | Item | Status |
|---|------|--------|
| E.1 | Eventos `charge.overdue`, `charge.cancelled`, `notification.regua_enqueued` | Pendente |
| E.2 | Hooks em `webhook-side-effects` + enqueue régua | Pendente |
| E.3 | Docs `N8N_WEBHOOKS` + `N8N_REGUA_WORKFLOW_EXEMPLO` + deploy | Pendente |
| E.4 | Testes unitários n8n + side-effects | Pendente |
| E.5 | PR + handoff Tech Lead | Pendente |

---

## 5. Ordem de execução

```
1. git pull main
2. feat/sprint-e-n8n-orquestracao
3. Executar DEMANDA_SPRINT_E_N8N_ORQUESTRACAO.md
4. quality:gate → PR → handoff TL (sem merge IA)

Contínuo: DoD FASE2 · PRs < 400 linhas úteis
```

---

## 6. Regras absolutas

1. **Stack:** Node 20 + TS 5.7 + Express + `pg` raw + BullMQ.
2. **Multi-tenant:** `tenant_id` + RLS / `SET LOCAL app.tenant_id`.
3. **Secrets:** nunca no código nem no git.
4. **Webhooks entrada:** inbox pattern; dedup `external_event_id`.
5. **n8n saída:** fire-and-forget; noop sem URL.
6. **Estados terminais:** `paga` e `cancelada` não retrocedem.
7. **Migrations:** `db/migrations/NNN_descricao.sql`, idempotentes.
8. **Cobertura:** ≥ 82% em `application/`/`domain` (`vitest.config.ts`).

---

## 7. Mapa de documentação

| Documento | Uso |
|-----------|-----|
| **Este arquivo** | Snapshot, gates, prioridades |
| [PROMPT_FABRICA_ATUALIZACAO_MAIO2026.md](./PROMPT_FABRICA_ATUALIZACAO_MAIO2026.md) | Colar no Cursor / fábrica |
| [DEMANDA_SPRINT_E_N8N_ORQUESTRACAO.md](./DEMANDA_SPRINT_E_N8N_ORQUESTRACAO.md) | **Sprint E (atual)** |
| [GOVERNANCA_FABRICA_COMMIT_PR.md](./GOVERNANCA_FABRICA_COMMIT_PR.md) | IA abre PR; TL merge |
| [docs/N8N_WEBHOOKS.md](../docs/N8N_WEBHOOKS.md) | Contrato outbound |
| [docs/INBOX_WEBHOOK_IDEMPOTENCIA.md](../docs/INBOX_WEBHOOK_IDEMPOTENCIA.md) | Contrato inbound |
| [docs/FASE2_KICKOFF_QUALIDADE.md](../docs/FASE2_KICKOFF_QUALIDADE.md) | DoD por PR |

---

## 8. SYSTEM PROMPT (colar no Cursor antes de codar)

```
Repositório: cobranca-saas-api (SaaS cobranças Boleto/PIX, multi-tenant BR).

ESTADO (Maio 2026):
- main (1f4c328): Sprints B, C, D mergeados.
- Próxima entrega: Sprint E — DEMANDA_SPRINT_E_N8N_ORQUESTRACAO.md (P3 n8n)

ANTES DE CODAR:
1. Ler DEMANDA_SPRINT_E + RETOMADA_FABRICA + GOVERNANCA_FABRICA_COMMIT_PR.md
2. git checkout main && git pull && git checkout -b feat/sprint-e-n8n-orquestracao
3. n8n outbound parcial existe — ESTENDER eventos, não refazer inbox nem notificações internas

ENTREGAS: charge.overdue, charge.cancelled, notification.regua_enqueued + docs + testes.
Após PR: handoff Tech Lead (IA NÃO faz merge).

Regras: multi-tenant, audit_log, inbox dedup, sem NFS-e, sem secrets no código.
Governança: IA só abre PR — Tech Lead aprova merge.
Stack: Node 20, Express, pg, BullMQ.
```

---

## 9. Ritual PO + Tech Lead (30 min)

1. Confirmar `main` @ `1f4c328` ou posterior (`git pull`).
2. Gates: `npm test`, `portal:test`, CI `quality:gate`.
3. Validar respostas PO na secção “Perguntas” da DEMANDA Sprint E (URL n8n staging).
4. Priorizar **uma** sprint por vez; atualizar secção 4.5 com data.

## 10. Autorização PO — IA abre PR, Tech Lead aprova

| Ator | Ação |
|------|------|
| **IA (fábrica)** | Commit + push + **abrir PR** + **handoff** ao Tech Lead |
| **IA** | **Proibido:** merge em `main`, `gh pr merge` |
| **Tech Lead** | Revisar PR, CI, código → **approve + merge** |
| **PO** | Aceite produto (demo n8n + régua) |

Checklist G1–G7: [GOVERNANCA_FABRICA_COMMIT_PR.md](./GOVERNANCA_FABRICA_COMMIT_PR.md).

---

*Atualizado após merge PR #9 (Sprint D). Próxima atualização: após Sprint E merge.*
