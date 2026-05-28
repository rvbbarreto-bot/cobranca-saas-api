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
| Sprint J — CI Asaas manual | #17 | Concluído |
| Playwright E2E + n8n JSON | #18–#19 | Concluído |
| Sprint L — factory + Inter/Cora | #20–#21 | Concluído |
| **Sprint M — C6 + portal dinâmico** | [#22](https://github.com/rvbbarreto-bot/cobranca-saas-api/pull/22) | Concluído |
| **P2 Inter + portal + hardening** | [#24](https://github.com/rvbbarreto-bot/cobranca-saas-api/pull/24) | Concluído (`3ad069e`) |
| **Portal UI P0 — tokens / a11y** | [#25](https://github.com/rvbbarreto-bot/cobranca-saas-api/pull/25) | Concluído (`85c5d34`) |
| **Sprint N Onda A (parcial)** | [#26](https://github.com/rvbbarreto-bot/cobranca-saas-api/pull/26) | Concluído (`4e69efa`) |
| **Sprint K — ops foundation (DLQ/SLI)** | PR aberto | DLQ, admin metrics, `e2e-asaas.yml` |

**Testes:** `npm test` · `portal:test` · `quality:gate` no CI de cada PR

**Branch fábrica:** `main` — **Sprint N Fase 2** (Ondas B + 0 + D)

---

## 2. Gate de entrada

```bash
git fetch origin && git checkout main && git pull origin main
git checkout -b feat/sprint-n-entrega-produto
npm ci && npm run migrate && npm run seed:dev
npm run build && npm test && npm run portal:test
npm run quality:gate
```

---

## 3. Implementado (não refazer)

- Gateway universal: Asaas / Inter / Cora / C6, migration 025–027, worker + charge-sync
- P2.2 endereço pagador obrigatório Inter/Cora/C6 + portal cliente endereço
- P2.3 smoke Inter, P2.4 PEM 422, revisão pós-merge (#24)
- Portal Onda C MVP: histórico, enviar, Ver PDF condicional, WhatsApp opt-in
- Portal UI P0: `theme-tokens.css`, `BrDatePicker`, `ClienteAutocomplete`, toggle tema

---

## 4. Trabalho imediato — Sprint N Fase 2

**Pacote atual:** [DEMANDA_SPRINT_N_FASE2_ONDAS_B_D.md](./DEMANDA_SPRINT_N_FASE2_ONDAS_B_D.md)  
**Pacote mãe:** [DEMANDA_SPRINT_N_ENTREGA_PRODUTO.md](./DEMANDA_SPRINT_N_ENTREGA_PRODUTO.md)  
**Coordenação P2:** [COORDENACAO_ENTREGA_P2.md](./COORDENACAO_ENTREGA_P2.md)

| Onda | Status | Próximo |
|------|--------|---------|
| **A** | ✅ Parcial (#26) | Opcional: Clientes/Config/Login |
| **0** | 🔴 Pendente QA | Checklists + relatório homolog |
| **B** | 🔵 **AGORA** | `feat/p2-inter-pdf` + mock HTTP |
| **C** | ⏸ Após B | Relatórios filtros data |
| **D** | 🔵 **AGORA** | `feat/sprint-n-inter-webhook` |

### Decisões PO (Sprint N)

| Pergunta | Decisão |
|----------|---------|
| Homolog Inter bloqueada (cert) | **Não para** Ondas 0, A, D-paralelo |
| PDF Inter (Onda B) | Merge com **testes mock**; homolog real documentada |
| BB sandbox | **Sprint O** (fora de N) |
| Escopo UI | P1 listado na demanda; P2/P3 só doc |

### Bloqueios conhecidos

| Bloqueio | Impacto | Ação |
|----------|---------|------|
| Inter `SSL unknown ca` | Emissão/PDF real sandbox | QA + banco; Onda B com mock |
| PDF placeholder `inter://` | Ver PDF sem arquivo | Onda B |

---

## 5. Ordem de execução

```text
main (4e69efa)
  ├── (paralelo) Onda 0 QA humano
  ├── Onda B: feat/p2-inter-pdf
  ├── Onda D: feat/sprint-n-inter-webhook
  └── Opcional: feat/sprint-n-portal-polish (Onda A restante)
```

---

## 6. Regras absolutas

Multi-tenant · RLS · credenciais cifradas · **nunca** commitar PEM/API keys · G1–G8 antes de cada PR.

---

## 7. Documentação

| Doc | Uso |
|-----|-----|
| [DEMANDA_SPRINT_N_FASE2_ONDAS_B_D.md](./DEMANDA_SPRINT_N_FASE2_ONDAS_B_D.md) | **ATUAL — próxima entrega** |
| [DEMANDA_SPRINT_N_ENTREGA_PRODUTO.md](./DEMANDA_SPRINT_N_ENTREGA_PRODUTO.md) | Pacote mãe Sprint N |
| [docs/QA_P2_POS_MERGE_CHECKLIST.md](../docs/QA_P2_POS_MERGE_CHECKLIST.md) | Homolog Onda 0 |
| [docs/QA_PORTAL_UI_TOKENS_P0.md](../docs/QA_PORTAL_UI_TOKENS_P0.md) | UI Onda 0 |
| [docs/evidencias/SPRINT_N_HOMOLOG_RELATORIO_TEMPLATE.md](../docs/evidencias/SPRINT_N_HOMOLOG_RELATORIO_TEMPLATE.md) | Relatório QA |
| [DEMANDA_PO_P2_INTER_PORTAL_ROADMAP.md](./DEMANDA_PO_P2_INTER_PORTAL_ROADMAP.md) | P2.1 / P2.5 (Onda B) |
| [docs/GATEWAY_UNIVERSAL.md](../docs/GATEWAY_UNIVERSAL.md) | Arquitetura |

---

## 8. SYSTEM PROMPT (colar no Cursor)

```
Repositório: cobranca-saas-api. main @ 4e69efa (Sprint N Onda A #26 mergeado).

SPRINT N FASE 2 — Ondas B + 0 + D em paralelo:
  Projeto_CobrancaBoleto/DEMANDA_SPRINT_N_FASE2_ONDAS_B_D.md

Branches: feat/p2-inter-pdf | feat/sprint-n-inter-webhook
Não refazer PR #26. PDF Inter: mock HTTP obrigatório.

Gates: quality:gate por PR.
```
