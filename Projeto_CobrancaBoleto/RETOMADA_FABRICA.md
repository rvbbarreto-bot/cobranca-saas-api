# Retomada da fábrica — SaaS Cobranças (PO + Tech Lead)

**Emissão:** Maio 2026 · **Repositório:** `cobranca-saas-api`  
**Operação diária:** este arquivo + [PROMPT_FABRICA_ATUALIZACAO_MAIO2026.md](./PROMPT_FABRICA_ATUALIZACAO_MAIO2026.md)

---

## 1. Onde estamos (snapshot)

| Marco | Commit / PR | Status |
|-------|-------------|--------|
| Sprints B–D | PR #6, #8, #9 | Concluído |
| **Sprint E — n8n** | **`main`** `6ef4c63` (PR #10) | **Concluído** |
| **Sprint F — editar cobrança** | — | **← ATUAL** |

**Testes:** `npm test` 203+ · `portal:test` 29 · CI `quality:gate`

**Branch fábrica:** `feat/sprint-f-portal-editar-cobranca` ← `main`

---

## 2. Gate de entrada

```bash
git fetch origin && git checkout main && git pull origin main
npm ci && npm run migrate && npm run seed:dev
npm run build && npm test && npm run portal:test && npm run quality:gate
```

Scripts: `validacao_fase_0.sh`, `validacao_sprint3.sh`, `validacao_sprint4.sh`

---

## 3. Implementado (não refazer)

- API + portal: login, dashboard, cobranças/clientes/NFs, magic link, `/configuracoes`, activate, cursor, PATCH cliente (**UI** `/clientes/:id/editar`)
- PATCH cobrança **API** + `patchPortalCobranca` em `api.ts` — falta só **tela** edição (Sprint F)
- Inbox idempotência, n8n outbound (5 eventos), SaaS billing 024

---

## 4. Trabalho imediato — Sprint F

**Pacote:** [DEMANDA_SPRINT_F_PORTAL_EDITAR_COBRANCA.md](./DEMANDA_SPRINT_F_PORTAL_EDITAR_COBRANCA.md)

| # | Item |
|---|------|
| F.1 | `cobrancaEditFormSchema` |
| F.2 | `CobrancaEditPage` — `/cobrancas/:chargeId/editar` |
| F.3 | Links em `BoletoDetalhePage` / `CobrancasPage` (ocultar se `paga`/`cancelada`) |
| F.4 | Vitest `CobrancaEditPage.test.tsx` |
| F.5 | `PORTAL_WEB.md` |
| F.6 | PR + handoff TL |

### Histórico B–E

| Sprint | PR |
|--------|-----|
| B activate + paginação | #6 |
| C `/configuracoes` | #8 |
| D inbox + deploy | #9 |
| E n8n régua/ciclo | #10 |

### Backlog

- **G:** `charge.emitted` n8n; runbook `ENABLE_MOCK_AUTH` / JWT (FASE2 A)
- **H:** `e2e:asaas:evidence` + checklist Sprint 1 (homolog PO)

---

## 5. Ordem de execução

```
git pull main → feat/sprint-f-portal-editar-cobranca
DEMANDA_SPRINT_F → quality:gate → PR → handoff (sem merge IA)
```

---

## 6. Regras absolutas

Multi-tenant · RLS · inbox dedup · n8n noop sem URL · estados terminais · migrations NNN · cobertura ≥82% · secrets fora do git.

---

## 7. Documentação

| Doc | Uso |
|-----|-----|
| [DEMANDA_SPRINT_F_PORTAL_EDITAR_COBRANCA.md](./DEMANDA_SPRINT_F_PORTAL_EDITAR_COBRANCA.md) | **Atual** |
| [GOVERNANCA_FABRICA_COMMIT_PR.md](./GOVERNANCA_FABRICA_COMMIT_PR.md) | PR / merge |
| [docs/N8N_WEBHOOKS.md](../docs/N8N_WEBHOOKS.md) | n8n |
| [docs/FASE2_KICKOFF_QUALIDADE.md](../docs/FASE2_KICKOFF_QUALIDADE.md) | DoD |

---

## 8. SYSTEM PROMPT (colar no Cursor)

```
Repositório: cobranca-saas-api. main (6ef4c63) — Sprint E mergeada.

PRÓXIMA: Sprint F — DEMANDA_SPRINT_F_PORTAL_EDITAR_COBRANCA.md
Branch: feat/sprint-f-portal-editar-cobranca

PATCH /v1/portal/cobrancas/:id já existe. Criar UI edição (espelhar ClienteEditPage).
Bloquear edição se paga/cancelada. portal:test + PORTAL_WEB.md.

Governança: IA abre PR; Tech Lead merge. Sem NFS-e.
```

---

## 9–10. Ritual PO / Governança

IA: commit + PR + handoff. **Proibido:** merge `main`. TL: review + merge. PO: demo edição cobrança.

---

*Atualizado após merge PR #10 (Sprint E).*
