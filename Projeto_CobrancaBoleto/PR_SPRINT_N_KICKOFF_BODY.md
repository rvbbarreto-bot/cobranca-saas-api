# Sprint N — Kickoff PR (corpo sugerido)

Use este corpo no **primeiro PR** de kickoff (`feat/sprint-n-entrega-produto`) ou como issue épico.

## Summary

Kickoff **Sprint N — Entrega de produto**: homolog formal pós-P2, polish portal (detalhe boleto + telas P1), PDF Inter (Onda B), relatórios com filtro de data, início gateway N (webhook Inter + estorno).

Pacote PO/Tech Lead: `Projeto_CobrancaBoleto/DEMANDA_SPRINT_N_ENTREGA_PRODUTO.md`

## Contexto

- `main` inclui P2 (#24) e portal UI tokens P0 (#25).
- Homolog Inter sandbox continua bloqueada externamente (certificado).
- Regra: ondas 0 e A seguem independente do OAuth Inter.

## Ondas

| Onda | Escopo | Prioridade |
|------|--------|------------|
| 0 | QA checklists + evidências | P0 |
| A | Portal polish + detalhe boleto | P1 |
| B | PDF Inter + Ver PDF real | P1 (mock OK) |
| C | Relatórios filtros data | P2 |
| D | Webhook Inter + estorno | P1/P2 |

## Test plan

- [ ] `npm run quality:gate`
- [ ] QA: `docs/QA_P2_POS_MERGE_CHECKLIST.md`
- [ ] UI: `docs/QA_PORTAL_UI_TOKENS_P0.md`
- [ ] Evidências: `docs/evidencias/SPRINT_N_HOMOLOG_RELATORIO.md`

## Handoff Tech Lead

PR de kickoff pode ser **só documentação** (demanda + coordenação) ou já incluir N.1.1 — aguardar revisão antes de merge de código grande.
