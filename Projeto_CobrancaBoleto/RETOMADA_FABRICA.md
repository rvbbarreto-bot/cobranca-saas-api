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
| FASE2 A — auth produção | #15 | Concluído |
| **Sprint I — consolidar `main`** | (PR aberto) | **← ATUAL** |

**Testes:** `npm test` 220+ · `portal:test` 33 · CI `quality:gate`

**Branch integração:** `feat/sprint1-payment-emission-portal` @ `ee4b8d8`  
**`main`:** ainda em Sprint F até merge do PR Sprint I

---

## 2. Gate de entrada

```bash
git fetch origin
git checkout feat/sprint1-payment-emission-portal && git pull origin feat/sprint1-payment-emission-portal
npm ci && npm run migrate && npm run seed:dev
npm run build && npm test && npm run portal:test && npm run quality:gate
```

---

## 3. Implementado (não refazer)

- API + portal completo (editar cobrança, configurações, paginação, SaaS billing)
- Inbox idempotência, n8n outbound (**6 eventos**, incl. `charge.emitted`)
- Runner E2E Asaas + runbook auth (FASE2 A)

---

## 4. Trabalho imediato — Sprint I

**Pacote:** [DEMANDA_SPRINT_I_CONSOLIDACAO_MAIN.md](./DEMANDA_SPRINT_I_CONSOLIDACAO_MAIN.md)

| # | Item |
|---|------|
| I.1 | `docs/RELEASE_NOTES_INTEGRACAO_MAIN.md` |
| I.2 | RETOMADA + PROMPT |
| I.3 | PR `feat/sprint1-payment-emission-portal` → `main` |
| I.4 | CI verde + handoff TL (**sem merge IA**) |

### Histórico

| Sprint | PR |
|--------|-----|
| B activate + paginação | #6 |
| C `/configuracoes` | #8 |
| D inbox + deploy | #9 |
| E n8n régua/ciclo | #10 |
| F portal editar cobrança | #11 |
| G `charge.emitted` n8n | #12 |
| H homolog Asaas E2E | #14 |
| FASE2 A auth produção | #15 |

### Backlog pós–Sprint I

| Ordem | Item | Pacote |
|-------|------|--------|
| 1 | Homolog PO checklist sandbox | Processo (PO) |
| 2 | CI `workflow_dispatch` Asaas E2E | [DEMANDA_SPRINT_J_CI_ASAAS_E2E.md](./DEMANDA_SPRINT_J_CI_ASAAS_E2E.md) |

---

## 5. Ordem de execução

```
feat/sprint1-payment-emission-portal → PR main (Sprint I)
TL merge → git pull main
Sprint J (opcional CI Asaas)
```

---

## 6. Regras absolutas

Multi-tenant · RLS · inbox dedup · n8n noop sem URL · estados terminais · migrations NNN · cobertura ≥82% · **nunca** commitar `ASAAS_API_KEY` nem JSON E2E com dados reais.

---

## 7. Documentação

| Doc | Uso |
|-----|-----|
| [DEMANDA_SPRINT_I_CONSOLIDACAO_MAIN.md](./DEMANDA_SPRINT_I_CONSOLIDACAO_MAIN.md) | **Atual** |
| [docs/RELEASE_NOTES_INTEGRACAO_MAIN.md](../docs/RELEASE_NOTES_INTEGRACAO_MAIN.md) | Release |
| [GOVERNANCA_FABRICA_COMMIT_PR.md](./GOVERNANCA_FABRICA_COMMIT_PR.md) | PR / merge |

---

## 8. SYSTEM PROMPT (colar no Cursor)

```
Repositório: cobranca-saas-api. Sprints B–H + FASE2 A mergeados na branch integração.
Sprint I ATUAL: PR feat/sprint1-payment-emission-portal → main (release notes).
Pacote: Projeto_CobrancaBoleto/DEMANDA_SPRINT_I_CONSOLIDACAO_MAIN.md
Gate: npm test + portal:test + quality:gate
Governança: IA abre PR; Tech Lead merge.
Próximo após I: DEMANDA_SPRINT_J_CI_ASAAS_E2E.md
```
