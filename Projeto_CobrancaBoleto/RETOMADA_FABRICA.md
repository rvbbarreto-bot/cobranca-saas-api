# Retomada da fábrica — SaaS Cobranças (PO + Tech Lead)

**Emissão:** Maio 2026 · **Repositório:** `cobranca-saas-api`  
**Operação diária:** este arquivo + [PROMPT_FABRICA_ATUALIZACAO_MAIO2026.md](./PROMPT_FABRICA_ATUALIZACAO_MAIO2026.md)

---

## 1. Onde estamos (snapshot)

| Marco | PR | Status |
|-------|-----|--------|
| Sprints B–F | #6–#11 | Concluído |
| Sprint G — `charge.emitted` n8n | #12 | Concluído |
| Sprint H — homolog Asaas E2E | #14 | Concluído |
| **FASE2 A — auth produção** | #15 (em revisão) | **← ATUAL** |

**Testes:** `npm test` 211+ · `portal:test` 33 · CI `quality:gate`

**Branch fábrica:** `feat/fase2-a-auth-producao` ← `feat/sprint1-payment-emission-portal` (integração)

---

## 2. Gate de entrada

```bash
git fetch origin && git checkout main && git pull origin main
npm ci && npm run migrate && npm run seed:dev
npm run build && npm test && npm run portal:test && npm run quality:gate
```

---

## 3. Implementado (não refazer)

- API + portal completo (editar cobrança, configurações, paginação, SaaS billing)
- Inbox idempotência, n8n outbound (**6 eventos**, incl. `charge.emitted`)
- Runner E2E Asaas com assertions nomeadas (Sprint H) + runbook auth (FASE2 A)

---

## 4. Trabalho imediato — FASE2 A

**Pacote:** [DEMANDA_FASE2_A_AUTH_PRODUCAO.md](./DEMANDA_FASE2_A_AUTH_PRODUCAO.md)

| # | Item |
|---|------|
| A.1 | `RUNBOOK_AUTH_PRODUCAO.md` |
| A.2 | `check:prod-env` anti-placeholder |
| A.3–A.4 | Testes unit + integração mocks 404 |
| A.5 | Contrato + portal ajuda |
| A.6 | CI check prod-env |
| A.7 | PR + handoff TL |

### Histórico B–H

| Sprint | PR |
|--------|-----|
| B activate + paginação | #6 |
| C `/configuracoes` | #8 |
| D inbox + deploy | #9 |
| E n8n régua/ciclo | #10 |
| F portal editar cobrança | #11 |
| G `charge.emitted` n8n | #12 |
| H homolog Asaas E2E | #14 |

### Backlog pós–FASE2 A

- Aceite PO checklist sandbox (processo)
- CI `workflow_dispatch` Asaas E2E
- Consolidar `main` ← branch integração sprint1

---

## 5. Ordem de execução

```
git pull → feat/fase2-a-auth-producao
DEMANDA_FASE2_A → quality:gate → PR → handoff (sem merge IA)
```

---

## 6. Regras absolutas

Multi-tenant · RLS · inbox dedup · n8n noop sem URL · estados terminais · migrations NNN · cobertura ≥82% · **nunca** commitar `ASAAS_API_KEY` nem JSON E2E com dados reais.

---

## 7. Documentação

| Doc | Uso |
|-----|-----|
| [DEMANDA_FASE2_A_AUTH_PRODUCAO.md](./DEMANDA_FASE2_A_AUTH_PRODUCAO.md) | **Atual** |
| [docs/RUNBOOK_AUTH_PRODUCAO.md](../docs/RUNBOOK_AUTH_PRODUCAO.md) | Auth produção |
| [GOVERNANCA_FABRICA_COMMIT_PR.md](./GOVERNANCA_FABRICA_COMMIT_PR.md) | PR / merge |

---

## 8. SYSTEM PROMPT (colar no Cursor)

```
Repositório: cobranca-saas-api. Sprints B–H mergeadas na branch integração.
FASE2 A ATUAL: runbook auth produção + JWT/mock + testes.
Branch: feat/fase2-a-auth-producao
Pacote: Projeto_CobrancaBoleto/DEMANDA_FASE2_A_AUTH_PRODUCAO.md
Gate: npm test + portal:test + quality:gate
Governança: IA abre PR; Tech Lead merge.
```
