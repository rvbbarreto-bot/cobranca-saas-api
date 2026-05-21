# Briefing fábrica — SaaS Cobranças API · Maio 2026

Leia primeiro: `Projeto_CobrancaBoleto/RETOMADA_FABRICA.md`.

## Estado atual

- **main** (`fcaae14`): Sprints B–F mergeados (PR #6–#11).
- **Próxima entrega:** Sprint G — [DEMANDA_SPRINT_G_CHARGE_EMITTED_N8N.md](./DEMANDA_SPRINT_G_CHARGE_EMITTED_N8N.md)
- **Testes:** `npm test` → 206+ · `npm run portal:test` → 33 · `npm run quality:gate`

## NÃO refazer

- Portal editar cobrança, PATCH cobrança API, inbox, n8n (exceto `charge.emitted`), `/configuracoes`, paginação, activate.
- NFS-e / `/internal/fiscal` fora de escopo.

## Sprint G — ATUAL (`charge.emitted` + testes)

1. `git pull main` → `feat/sprint-g-charge-emitted-n8n`
2. `emitN8nPlatformEvent` após emissão OK + `N8N_WEBHOOKS.md`
3. Unit: `payment-emission-n8n.test.ts` · Funcional: bateria B6b
4. PR + handoff TL — **sem merge**

## Backlog (após G)

| Sprint | Tema |
|--------|------|
| H | Homolog: `e2e:asaas:evidence` + checklist Sprint 1 |
| — | Runbook auth prod `ENABLE_MOCK_AUTH` / JWT (FASE2 A) |

## Regras e gates

Ver [GOVERNANCA_FABRICA_COMMIT_PR.md](./GOVERNANCA_FABRICA_COMMIT_PR.md) e gates em RETOMADA §2.

Multi-tenant · sem secrets no git · DoD FASE2 · PRs < 400 linhas úteis.
