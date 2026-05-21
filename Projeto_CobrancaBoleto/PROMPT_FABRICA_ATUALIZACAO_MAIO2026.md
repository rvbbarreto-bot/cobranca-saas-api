# Briefing fábrica — SaaS Cobranças API · Maio 2026

Leia primeiro: `Projeto_CobrancaBoleto/RETOMADA_FABRICA.md`.

## Estado atual

- **main:** Sprints B–G mergeados (PR #6–#12).
- **Próxima entrega:** Sprint H — [DEMANDA_SPRINT_H_HOMOLOG_ASAAS_EVIDENCIA.md](./DEMANDA_SPRINT_H_HOMOLOG_ASAAS_EVIDENCIA.md)
- **Testes:** `npm test` → 208+ · `npm run portal:test` → 33 · `npm run quality:gate`

## NÃO refazer

- Portal/API já entregues (editar cobrança, n8n 6 eventos, inbox, régua).
- Reimplementar runner E2E do zero — **estender e alinhar** ao checklist.
- NFS-e / `/internal/fiscal` fora de escopo.

## Sprint H — ATUAL (homolog Asaas + evidências)

1. `git pull main` → `feat/sprint-h-homolog-asaas-evidencia`
2. Runner `asaas-sandbox-e2e-runner.ts` ↔ 13 critérios + template JSON redigido
3. Unit: `tests/dev/asaas-e2e-evidence.test.ts` · Funcional: script sem DB
4. `npm run e2e:asaas:evidence` **local** (sandbox) — evidência no PR, não no git
5. PR + handoff TL — **sem merge**

## Backlog (após H)

| Item | Tema |
|------|------|
| FASE2 A | Runbook auth prod `ENABLE_MOCK_AUTH` / JWT |
| CI opcional | Job manual Asaas E2E com secrets GitHub |

## Regras e gates

Ver [GOVERNANCA_FABRICA_COMMIT_PR.md](./GOVERNANCA_FABRICA_COMMIT_PR.md) e gates em RETOMADA §2.

Multi-tenant · sem secrets no git · DoD FASE2 · PRs < 400 linhas úteis.
