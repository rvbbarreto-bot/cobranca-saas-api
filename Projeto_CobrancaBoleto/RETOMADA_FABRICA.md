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
| **Sprint K — ops foundation (DLQ/SLI)** | [#28](https://github.com/rvbbarreto-bot/cobranca-saas-api/pull/28) | ✅ Concluído (`e734aad`) |
| **Sprint N Ondas B/D + gaps** | [#27](https://github.com/rvbbarreto-bot/cobranca-saas-api/pull/27), #30 | ✅ Concluído |
| **Fix schema clientes (027)** | [#33](https://github.com/rvbbarreto-bot/cobranca-saas-api/pull/33) | ✅ Concluído (`f9120a6`) |

**Testes:** `npm test` · `portal:test` · `quality:gate` no CI de cada PR

**Branch fábrica:** `main` @ `f9120a6+` — **Onda C (relatórios)** — ver [AUTORIZACAO_PROXIMO_DESENVOLVIMENTO.md](./AUTORIZACAO_PROXIMO_DESENVOLVIMENTO.md)

---

## 2. Gate de entrada

```bash
git fetch origin && git checkout main && git pull origin main
git checkout -b feat/sprint-n-relatorios-filtros
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

## 4. Trabalho imediato — Onda C + homolog

**Autorização PO:** [AUTORIZACAO_PROXIMO_DESENVOLVIMENTO.md](./AUTORIZACAO_PROXIMO_DESENVOLVIMENTO.md)  
**Pacote mãe:** [DEMANDA_SPRINT_N_ENTREGA_PRODUTO.md](./DEMANDA_SPRINT_N_ENTREGA_PRODUTO.md) (§ N.3.1)

| Onda | Status | Próximo |
|------|--------|---------|
| **A** | ✅ Parcial (#26) | Opcional: `feat/sprint-n-portal-polish` |
| **0** | 🟡 Em fechamento | Revalidar C1–C3 pós #33 · assinar relatório |
| **B** | ✅ Concluída | — |
| **C** | 🔵 **AGORA** | `feat/sprint-n-relatorios-filtros` |
| **D** | ✅ Concluída | — |

### Decisões PO (vigentes)

| Pergunta | Decisão |
|----------|---------|
| Próximo dev | **Onda C N.3.1** (relatórios filtros data) |
| Homolog Inter real | Opcional no relatório; não bloqueia merge C |
| BB sandbox | **Sprint O** (fora de N) |

---

## 5. Ordem de execução

```text
main (f9120a6+)
  ├── Dev: feat/sprint-n-relatorios-filtros (Onda C)
  ├── Paralelo: Onda 0 homolog (C1–C3 pós migrate 027)
  └── Opcional: feat/sprint-n-portal-polish
```

---

## 6. Regras absolutas

Multi-tenant · RLS · credenciais cifradas · **nunca** commitar PEM/API keys · G1–G8 antes de cada PR.

---

## 7. Documentação

| Doc | Uso |
|-----|-----|
| [AUTORIZACAO_PROXIMO_DESENVOLVIMENTO.md](./AUTORIZACAO_PROXIMO_DESENVOLVIMENTO.md) | **ATUAL — autorização PO dev** |
| [DEMANDA_SPRINT_N_FASE2_ONDAS_B_D.md](./DEMANDA_SPRINT_N_FASE2_ONDAS_B_D.md) | Histórico B/D (encerrado) |
| [DEMANDA_SPRINT_N_ENTREGA_PRODUTO.md](./DEMANDA_SPRINT_N_ENTREGA_PRODUTO.md) | Pacote mãe Sprint N |
| [docs/QA_P2_POS_MERGE_CHECKLIST.md](../docs/QA_P2_POS_MERGE_CHECKLIST.md) | Homolog Onda 0 |
| [docs/QA_PORTAL_UI_TOKENS_P0.md](../docs/QA_PORTAL_UI_TOKENS_P0.md) | UI Onda 0 |
| [docs/evidencias/SPRINT_N_HOMOLOG_RELATORIO_TEMPLATE.md](../docs/evidencias/SPRINT_N_HOMOLOG_RELATORIO_TEMPLATE.md) | Relatório QA |
| [DEMANDA_PO_P2_INTER_PORTAL_ROADMAP.md](./DEMANDA_PO_P2_INTER_PORTAL_ROADMAP.md) | P2.1 / P2.5 (Onda B) |
| [docs/GATEWAY_UNIVERSAL.md](../docs/GATEWAY_UNIVERSAL.md) | Arquitetura |

---

## 8. SYSTEM PROMPT (colar no Cursor)

```
Repositório: cobranca-saas-api. main @ f9120a6+.
AUTORIZAÇÃO PO: Projeto_CobrancaBoleto/AUTORIZACAO_PROXIMO_DESENVOLVIMENTO.md
Branch: feat/sprint-n-relatorios-filtros (Onda C — N.3.1)
Não reimplementar Ondas B/D. migrate 027 obrigatório.
Gates: quality:gate por PR.
```
