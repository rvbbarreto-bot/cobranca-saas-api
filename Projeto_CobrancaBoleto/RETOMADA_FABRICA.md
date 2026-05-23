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
| **Portal UI P0 — tokens / a11y** | [#25](https://github.com/rvbbarreto-bot/cobranca-saas-api/pull/25) | Concluído em `main` (`85c5d34`) |

**Testes:** `npm test` · `portal:test` · `quality:gate` verde no último merge portal

**Branch fábrica:** `main` — **Sprint N ATUAL** (ver secção 4)

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

## 4. Trabalho imediato — Sprint N (ENTREGA DE PRODUTO)

**Pacote:** [DEMANDA_SPRINT_N_ENTREGA_PRODUTO.md](./DEMANDA_SPRINT_N_ENTREGA_PRODUTO.md)  
**Kickoff PR:** [PR_SPRINT_N_KICKOFF_BODY.md](./PR_SPRINT_N_KICKOFF_BODY.md)  
**Coordenação P2 (referência):** [COORDENACAO_ENTREGA_P2.md](./COORDENACAO_ENTREGA_P2.md)

| Onda | Itens | Prioridade |
|------|-------|------------|
| **0** | Homolog QA + evidências (`QA_P2`, `QA_PORTAL_UI`, relatório Sprint N) | P0 |
| **A** | Portal polish: detalhe boleto, telas P1, BrDatePicker edição, a11y | P1 |
| **B** | PDF Inter real + Ver PDF (mock se cert bloqueado) | P1 |
| **C** | Relatórios filtros data + rotas roadmap | P2 |
| **D** | Webhook Inter, charge-sync, estorno `estornada` | P1/P2 |

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
feat/sprint-n-entrega-produto
  ├── (paralelo) Onda 0 QA + Onda A portal + spike Onda D
  ├── Onda B feat/p2-inter-pdf (quando mock pronto)
  └── PRs ≤ ~400 linhas → quality:gate → merge Tech Lead
```

---

## 6. Regras absolutas

Multi-tenant · RLS · credenciais cifradas · **nunca** commitar PEM/API keys · G1–G8 antes de cada PR.

---

## 7. Documentação

| Doc | Uso |
|-----|-----|
| [DEMANDA_SPRINT_N_ENTREGA_PRODUTO.md](./DEMANDA_SPRINT_N_ENTREGA_PRODUTO.md) | **ATUAL — pacote completo** |
| [docs/QA_P2_POS_MERGE_CHECKLIST.md](../docs/QA_P2_POS_MERGE_CHECKLIST.md) | Homolog Onda 0 |
| [docs/QA_PORTAL_UI_TOKENS_P0.md](../docs/QA_PORTAL_UI_TOKENS_P0.md) | UI Onda 0 |
| [docs/evidencias/SPRINT_N_HOMOLOG_RELATORIO_TEMPLATE.md](../docs/evidencias/SPRINT_N_HOMOLOG_RELATORIO_TEMPLATE.md) | Relatório QA |
| [DEMANDA_PO_P2_INTER_PORTAL_ROADMAP.md](./DEMANDA_PO_P2_INTER_PORTAL_ROADMAP.md) | P2.1 / P2.5 (Onda B) |
| [docs/GATEWAY_UNIVERSAL.md](../docs/GATEWAY_UNIVERSAL.md) | Arquitetura |

---

## 8. SYSTEM PROMPT (colar no Cursor)

```
Repositório: cobranca-saas-api. main ≥ 85c5d34 (P2 #24 + portal UI P0 #25).

SPRINT N ATUAL — Entrega de produto:
  Projeto_CobrancaBoleto/DEMANDA_SPRINT_N_ENTREGA_PRODUTO.md

Branch: feat/sprint-n-entrega-produto (sub-branches por onda).
Ondas 0+A em paralelo; Onda B com mock se Inter bloqueado.
Não reimplementar P2.2, PEM, tokens P0, Onda C MVP.

Gates: quality:gate (build + test + portal:test + test:integration).
```
