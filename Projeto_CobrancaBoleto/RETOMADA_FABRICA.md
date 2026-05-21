# Retomada da fábrica — SaaS Cobranças (PO + Tech Lead)

**Emissão:** Maio 2026 · **Repositório:** `cobranca-saas-api`  
**Operação diária:** este arquivo + [PROMPT_FABRICA_ATUALIZACAO_MAIO2026.md](./PROMPT_FABRICA_ATUALIZACAO_MAIO2026.md)

---

## 1. Onde estamos (snapshot)

| Marco | Commit / PR | Status |
|-------|-------------|--------|
| Sprints B–F | PR #6–#11 | Concluído |
| **Sprint G — `charge.emitted` n8n** | PR #12 | **Concluído** |
| **Sprint H — homolog Asaas E2E** | PR #14 (em revisão) | **← ATUAL** |

**Testes:** `npm test` 208+ · `portal:test` 33 · CI `quality:gate`

**Branch fábrica:** `feat/sprint-h-homolog-asaas-evidencia` ← `main` + integração `feat/sprint1-payment-emission-portal`

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

- API + portal completo (incl. editar cobrança `/cobrancas/:id/editar`)
- Inbox idempotência, n8n outbound (**6 eventos**, incl. `charge.emitted`)
- Runner E2E Asaas (`npm run e2e:asaas:evidence`) — homologado na Sprint H (assertions nomeadas)

---

## 4. Trabalho imediato — Sprint H

**Pacote:** [DEMANDA_SPRINT_H_HOMOLOG_ASAAS_EVIDENCIA.md](./DEMANDA_SPRINT_H_HOMOLOG_ASAAS_EVIDENCIA.md)

| # | Item |
|---|------|
| H.1 | Assertions runner ↔ 13 critérios checklist |
| H.2 | `.gitignore` evidências + README + JSON EXAMPLE redigido |
| H.3 | Testes unitários `asaas-e2e-evidence` |
| H.4 | Teste funcional script sem `DATABASE_URL` |
| H.5 | Docs homolog PO + `ASAAS_SANDBOX_E2E.md` |
| H.6 | Execução sandbox (evidência fora do git) |
| H.7 | PR + handoff TL |

### Histórico B–G

| Sprint | PR |
|--------|-----|
| B activate + paginação | #6 |
| C `/configuracoes` | #8 |
| D inbox + deploy | #9 |
| E n8n régua/ciclo | #10 |
| F portal editar cobrança | #11 |
| G `charge.emitted` n8n | #12 |

### Backlog

- Runbook `ENABLE_MOCK_AUTH` / JWT produção (FASE2 A)
- CI opcional `workflow_dispatch` Asaas E2E

---

## 5. Ordem de execução

```
git pull main → feat/sprint-h-homolog-asaas-evidencia
DEMANDA_SPRINT_H → quality:gate → PR → handoff (sem merge IA)
```

---

## 6. Regras absolutas

Multi-tenant · RLS · inbox dedup · n8n noop sem URL · estados terminais · migrations NNN · cobertura ≥82% · **nunca** commitar `ASAAS_API_KEY` nem JSON E2E com dados reais.

---

## 7. Documentação

| Doc | Uso |
|-----|-----|
| [DEMANDA_SPRINT_H_HOMOLOG_ASAAS_EVIDENCIA.md](./DEMANDA_SPRINT_H_HOMOLOG_ASAAS_EVIDENCIA.md) | **Atual** |
| [docs/ASAAS_SANDBOX_E2E.md](../docs/ASAAS_SANDBOX_E2E.md) | E2E sandbox |
| [docs/evidencias/SPRINT1_ACEITE_CHECKLIST.md](../docs/evidencias/SPRINT1_ACEITE_CHECKLIST.md) | Aceite PO |
| [GOVERNANCA_FABRICA_COMMIT_PR.md](./GOVERNANCA_FABRICA_COMMIT_PR.md) | PR / merge |

---

## 8. SYSTEM PROMPT (colar no Cursor)

```
Repositório: cobranca-saas-api. main — Sprint G mergeada (PR #12).
Sprint H ATUAL: homolog Asaas E2E + evidências Sprint 1 + testes unit/func.
Branch: feat/sprint-h-homolog-asaas-evidencia
Pacote: Projeto_CobrancaBoleto/DEMANDA_SPRINT_H_HOMOLOG_ASAAS_EVIDENCIA.md
Gate: npm test + portal:test + quality:gate (sem RUN_ASAAS_E2E no CI)
Governança: IA abre PR; Tech Lead merge.
```
