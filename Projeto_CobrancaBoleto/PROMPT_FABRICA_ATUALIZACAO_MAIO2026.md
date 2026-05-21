# Briefing fábrica — SaaS Cobranças API · Maio 2026

Leia primeiro: `Projeto_CobrancaBoleto/RETOMADA_FABRICA.md`.

## Estado atual

- **Integração:** `feat/sprint1-payment-emission-portal` — Sprints B–H + FASE2 A (#15 mergeado).
- **`main`:** defasado (Sprint F) até PR Sprint I.
- **Próxima entrega:** Sprint I — [DEMANDA_SPRINT_I_CONSOLIDACAO_MAIN.md](./DEMANDA_SPRINT_I_CONSOLIDACAO_MAIN.md)
- **Testes:** `npm test` → 220+ · `portal:test` → 33 · `quality:gate`

## NÃO refazer

- FASE2 A, Sprint H E2E, n8n G, portal B–F (já na branch integração).
- Novo IdP/OAuth (fora de escopo).

## Sprint I — ATUAL (consolidar main)

1. PR `feat/sprint1-payment-emission-portal` → `main`
2. `docs/RELEASE_NOTES_INTEGRACAO_MAIN.md`
3. Handoff TL — **sem merge IA**

## Backlog (após Sprint I)

| Item | Pacote |
|------|--------|
| Homolog PO | Checklist Asaas assinado (processo) |
| CI manual Asaas | [DEMANDA_SPRINT_J_CI_ASAAS_E2E.md](./DEMANDA_SPRINT_J_CI_ASAAS_E2E.md) |

## Regras

[GOVERNANCA_FABRICA_COMMIT_PR.md](./GOVERNANCA_FABRICA_COMMIT_PR.md) · multi-tenant · secrets fora do git.
