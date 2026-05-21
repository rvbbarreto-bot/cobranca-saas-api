# Briefing fábrica — SaaS Cobranças API · Maio 2026

Leia primeiro: `Projeto_CobrancaBoleto/RETOMADA_FABRICA.md`.

## Estado atual

- **Integração:** `feat/sprint1-payment-emission-portal` — Sprints B–H + FASE2 A em curso.
- **Próxima entrega:** FASE2 A — [DEMANDA_FASE2_A_AUTH_PRODUCAO.md](./DEMANDA_FASE2_A_AUTH_PRODUCAO.md)
- **Testes:** `npm test` → 211+ · `portal:test` → 33 · `quality:gate`

## NÃO refazer

- Runner E2E Sprint H, n8n, portal, inbox (já na branch integração).
- Novo IdP/OAuth (fora de escopo).

## FASE2 A — ATUAL (auth produção)

1. `feat/fase2-a-auth-producao` (após merge sprint1)
2. Runbook `docs/RUNBOOK_AUTH_PRODUCAO.md` + testes JWT/mock
3. PR + handoff TL — **sem merge**

## Backlog (após FASE2 A)

| Item | Tema |
|------|------|
| Homolog PO | Checklist Asaas assinado |
| CI opcional | Job manual Asaas E2E |
| Release | `main` ← branch integração |

## Regras

[GOVERNANCA_FABRICA_COMMIT_PR.md](./GOVERNANCA_FABRICA_COMMIT_PR.md) · multi-tenant · secrets fora do git.
