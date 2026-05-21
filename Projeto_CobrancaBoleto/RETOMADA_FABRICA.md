# Retomada da fábrica — SaaS Cobranças (PO + Tech Lead)

**Emissão:** Maio 2026 · **Repositório:** `cobranca-saas-api`  
**Operação diária:** este arquivo + [PROMPT_FABRICA_ATUALIZACAO_MAIO2026.md](./PROMPT_FABRICA_ATUALIZACAO_MAIO2026.md)

---

## 1. Onde estamos (snapshot)

| Marco | Commit / PR | Status |
|-------|-------------|--------|
| Sprints B–F | PR #6–#11 | Concluído |
| **Sprint G — `charge.emitted` n8n** | `feat/sprint-g-charge-emitted-n8n` | **← ATUAL (fábrica)** |

**Testes:** `npm test` 206+ · `portal:test` 33 · CI `quality:gate`

**Branch fábrica:** `feat/sprint-g-charge-emitted-n8n` ← `main` (`fcaae14`)

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

- API + portal: login, dashboard, cobranças/clientes/NFs, magic link, `/configuracoes`, activate, cursor, PATCH cliente/cobrança + **UI** edição cobrança (`/cobrancas/:id/editar`)
- Inbox idempotência, n8n outbound (6 eventos com `charge.emitted`), SaaS billing 024

---

## 4. Trabalho imediato — Sprint G

**Pacote:** [DEMANDA_SPRINT_G_CHARGE_EMITTED_N8N.md](./DEMANDA_SPRINT_G_CHARGE_EMITTED_N8N.md)

| # | Item |
|---|------|
| G.1 | `charge.emitted` em `payment-emission-processor` |
| G.2 | Testes unitários emissão + n8n |
| G.3 | Bateria funcional B6b (PATCH 409 em `paga`) |
| G.4 | `N8N_WEBHOOKS.md` |
| G.5 | PR + handoff TL |

### Histórico B–F

| Sprint | PR |
|--------|-----|
| B activate + paginação | #6 |
| C `/configuracoes` | #8 |
| D inbox + deploy | #9 |
| E n8n régua/ciclo | #10 |
| F portal editar cobrança | #11 |

### Backlog

- **H:** `e2e:asaas:evidence` + checklist Sprint 1 (homolog PO)
- Runbook `ENABLE_MOCK_AUTH` / JWT produção (FASE2 A)

---

## 5. Ordem de execução

```
git pull main → feat/sprint-g-charge-emitted-n8n
DEMANDA_SPRINT_G → quality:gate → PR → handoff (sem merge IA)
```

---

## 6. Regras absolutas

Multi-tenant · RLS · inbox dedup · n8n noop sem URL · estados terminais · migrations NNN · cobertura ≥82% · secrets fora do git.

---

## 7. Documentação

| Doc | Uso |
|-----|-----|
| [DEMANDA_SPRINT_G_CHARGE_EMITTED_N8N.md](./DEMANDA_SPRINT_G_CHARGE_EMITTED_N8N.md) | **Atual** |
| [GOVERNANCA_FABRICA_COMMIT_PR.md](./GOVERNANCA_FABRICA_COMMIT_PR.md) | PR / merge |
| [docs/N8N_WEBHOOKS.md](../docs/N8N_WEBHOOKS.md) | n8n |
| [docs/FASE2_KICKOFF_QUALIDADE.md](../docs/FASE2_KICKOFF_QUALIDADE.md) | DoD |

---

## 8. SYSTEM PROMPT (colar no Cursor)

```
Repositório: cobranca-saas-api. main (fcaae14) — Sprint F mergeada.
Sprint G ATUAL: charge.emitted n8n + testes unitários/funcionais.
Branch: feat/sprint-g-charge-emitted-n8n
Pacote: Projeto_CobrancaBoleto/DEMANDA_SPRINT_G_CHARGE_EMITTED_N8N.md
Gate: npm test + portal:test + quality:gate
Governança: IA abre PR; Tech Lead merge.
```
