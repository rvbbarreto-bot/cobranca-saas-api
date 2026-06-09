# Sprint 1 — Início (PO autorizado 2026-06-07)

**Branch:** `feature/EXEQ-FISC-010-organization-model`  
**Autorização:** [`AUTORIZACAO_PO_SPRINT1_PROXIMA_DEMANDA.md`](../AUTORIZACAO_PO_SPRINT1_PROXIMA_DEMANDA.md) — De acordo PO 07/06/2026

## Entregas

| Issue | Status | Artefato |
|-------|--------|----------|
| EXEQ-FISC-010 | Implementado | `db/migrations/032_organization_and_serpro_config.sql`, `scripts/backfill-organization-from-tenants.ts` |
| EXEQ-FISC-011 | Implementado | `GET /v1/exeq/organizations`, `GET /v1/exeq/organizations/:id` |
| EXEQ-FISC-012 | Implementado | `GET/PATCH /v1/portal/fiscal/serpro-config`, `fiscal.serpro_config` |

## Comandos pós-pull

```powershell
npm run verify:sprint1
```

Equivalente manual: `npm run migrate` → `npm run backfill:organization` → vitest sprint1.

## Critérios DoD S1

- [x] Migration 032 forward-only
- [x] Backfill idempotente
- [x] API org EXEQ master
- [x] API serpro-config portal admin
- [x] Testes integração — **6 passed** (`npm run verify:sprint1`)
- [x] Evidência: `docs/evidencias/sprint-1/sprint1-verify-2026-06-07.json`
- [x] PR aberto: `feature/EXEQ-FISC-010-organization-model` → `feat/sprint-o-completude-cadastro-emissao`
