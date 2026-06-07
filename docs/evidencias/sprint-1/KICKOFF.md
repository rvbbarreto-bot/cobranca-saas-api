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
npm run migrate
npm run backfill:organization
npm run build
npm run test:integration
```

## Critérios DoD S1

- [x] Migration 032 forward-only
- [x] Backfill idempotente
- [x] API org EXEQ master
- [x] API serpro-config portal admin
- [x] Testes integração (`tests/fiscal-guias/sprint1-organization-serpro.integration.test.ts`)
- [ ] PR merge develop
