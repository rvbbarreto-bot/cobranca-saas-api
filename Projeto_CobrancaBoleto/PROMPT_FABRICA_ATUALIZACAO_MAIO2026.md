# Briefing fábrica — SaaS Cobranças API · Maio 2026

Leia primeiro: `Projeto_CobrancaBoleto/RETOMADA_FABRICA.md`.

## Estado atual

- **main** (`6ef4c63`): Sprints B, C, D, E mergeados (PR #6–#10).
- **Próxima entrega:** Sprint F — [DEMANDA_SPRINT_F_PORTAL_EDITAR_COBRANCA.md](./DEMANDA_SPRINT_F_PORTAL_EDITAR_COBRANCA.md)
- **Testes:** `npm test` → 203+ · `npm run portal:test` → 29 · `npm run quality:gate`

## NÃO refazer

- PATCH cobrança na API, inbox, n8n (5 eventos), `/configuracoes`, paginação, activate assinatura.
- NFS-e / `/internal/fiscal` fora de escopo.

## Sprint F — ATUAL (portal editar cobrança)

1. `git pull main` → `feat/sprint-f-portal-editar-cobranca`
2. UI `/cobrancas/:id/editar` + schema + links em detalhe/lista
3. `portal:test` + `PORTAL_WEB.md`
4. PR + handoff TL — **sem merge**

## Backlog (após F)

| Sprint | Tema |
|--------|------|
| G | `charge.emitted` n8n + runbook auth prod (FASE2 A) |
| H | Homolog: `e2e:asaas:evidence` + checklist Sprint 1 preenchido |

## Regras e gates

Ver [GOVERNANCA_FABRICA_COMMIT_PR.md](./GOVERNANCA_FABRICA_COMMIT_PR.md) e gates em RETOMADA §2.

Multi-tenant · sem secrets no git · DoD FASE2 · PRs < 400 linhas úteis.
