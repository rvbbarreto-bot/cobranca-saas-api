# Retomada da fábrica — SaaS Cobranças (PO + Tech Lead)

**Emissão:** Maio 2026 · **Repositório:** `cobranca-saas-api`  
**Operação diária:** este arquivo + [PROMPT_FABRICA_ATUALIZACAO_MAIO2026.md](./PROMPT_FABRICA_ATUALIZACAO_MAIO2026.md)

---

## 1. Onde estamos (snapshot)

| Marco | PR | Status |
|-------|-----|--------|
| Sprints B–F | #6–#11 | Concluído |
| Sprint G–H, FASE2 A | #12–#15 | Concluído |
| Sprint I — `main` consolidado | #16 | Concluído |
| **Sprint J — CI Asaas manual** | (PR aberto) | **← ATUAL** |

**Testes:** `npm test` 220+ · `portal:test` 33 · CI `quality:gate`

**Branch fábrica:** `feat/sprint-j-ci-asaas-e2e` ← `main`

---

## 2. Gate de entrada

```bash
git fetch origin && git checkout main && git pull origin main
git checkout -b feat/sprint-j-ci-asaas-e2e
npm ci && npm run build && npm test && npm run quality:gate
```

---

## 3. Implementado (não refazer)

- API + portal, inbox, n8n (6 eventos), E2E runner Sprint H, auth FASE2 A
- `main` alinhado à integração (Sprint I)

---

## 4. Trabalho imediato — Sprint J

**Pacote:** [DEMANDA_SPRINT_J_CI_ASAAS_E2E.md](./DEMANDA_SPRINT_J_CI_ASAAS_E2E.md)

| # | Item |
|---|------|
| J.1 | `.github/workflows/asaas-e2e-manual.yml` |
| J.2 | Docs evidencias + ASAAS_SANDBOX_E2E |
| J.3 | `tests/dev/asaas-e2e-workflow.test.ts` |
| J.4 | PR + secret `ASAAS_API_KEY` (TL) |

### Backlog pós–Sprint J

- Homolog PO: checklist sandbox assinado (processo)
- UX “Carregar mais” no portal (P1 Fase 2, quando PO priorizar)

---

## 5. Ordem de execução

```
feat/sprint-j-ci-asaas-e2e → quality:gate → PR → TL merge + configurar secret
```

---

## 6. Regras absolutas

Multi-tenant · RLS · inbox dedup · n8n noop sem URL · **nunca** commitar `ASAAS_API_KEY` nem JSON E2E real.

---

## 7. Documentação

| Doc | Uso |
|-----|-----|
| [DEMANDA_SPRINT_J_CI_ASAAS_E2E.md](./DEMANDA_SPRINT_J_CI_ASAAS_E2E.md) | **Atual** |
| [docs/evidencias/README.md](../docs/evidencias/README.md) | CI manual |

---

## 8. SYSTEM PROMPT (colar no Cursor)

```
Repositório: cobranca-saas-api. main atualizado (Sprint I #16).
Sprint J ATUAL: workflow_dispatch Asaas E2E + docs + teste YAML.
Branch: feat/sprint-j-ci-asaas-e2e
Pacote: DEMANDA_SPRINT_J_CI_ASAAS_E2E.md
Governança: IA abre PR; Tech Lead merge e configura ASAAS_API_KEY.
```
