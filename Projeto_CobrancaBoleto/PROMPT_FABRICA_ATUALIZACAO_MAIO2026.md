# Briefing fábrica — SaaS Cobranças API · Maio 2026

Leia primeiro: `Projeto_CobrancaBoleto/RETOMADA_FABRICA.md`.

## Estado atual

- **Código:** Sprints B–H entregues (ver branch `feat/sprint1-payment-emission-portal` se `main` estiver atrás).
- **Próxima entrega:** FASE2 A — [DEMANDA_FASE2_A_AUTH_PRODUCAO.md](./DEMANDA_FASE2_A_AUTH_PRODUCAO.md)
- **Testes:** `npm test` 208+ · `portal:test` 33 · `quality:gate`

## NÃO refazer

- Runner E2E, n8n, portal editar cobrança, inbox dedup.
- Novo IdP/OAuth (fora de escopo).

## FASE2 A — ATUAL (auth produção)

1. `git pull main` → `feat/fase2-a-auth-producao`
2. Runbook `docs/RUNBOOK_AUTH_PRODUCAO.md`
3. Endurecer `check:prod-env` + testes mocks 404 em produção
4. PR + handoff TL — **sem merge**

## Backlog (após FASE2 A)

| Item | Tema |
|------|------|
| Homolog PO | Checklist Asaas assinado (processo) |
| CI opcional | Job manual Asaas E2E |
| Release | Consolidar `main` com integração sprint1 |

## Regras

[GOVERNANCA_FABRICA_COMMIT_PR.md](./GOVERNANCA_FABRICA_COMMIT_PR.md) · multi-tenant · secrets fora do git.
