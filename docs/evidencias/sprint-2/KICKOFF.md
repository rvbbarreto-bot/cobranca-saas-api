# Sprint 2 — Certificate Vault (EXEQ-FISC-020/021)

**Branch:** `feature/EXEQ-FISC-020-certificate-vault`  
**Depende de:** Sprint 1 merge (`portal.organization`)

## Entregas

| Issue | Status | Artefato |
|-------|--------|----------|
| EXEQ-FISC-020 | Implementado | `db/migrations/033_certificate_vault.sql` |
| EXEQ-FISC-021 | Implementado | `scripts/backfill-certificate-vault-from-legacy.ts`, repositório vault + fallback legado |

## Comando fábrica (PO não precisa rodar manualmente)

```powershell
npm run verify:sprint2
```

## DoD S2

- [x] Migration 033 forward-only
- [x] Backfill legado → vault idempotente
- [x] POST/GET certificados usam vault (`certificate_vault_id` na resposta)
- [x] `fiscal.certificado_digital` — leitura fallback (deprecação 1 release)
- [x] Testes CI verdes via `verify:sprint2` (2 + 6 regressão)
- [x] Evidência: `docs/evidencias/sprint-2/sprint2-verify-2026-06-07.json`
- [ ] PR merge

## Próximo (S2 opcional / S3)

- EXEQ-FISC-022 — alertas expiração 30/15/7 dias
- EXEQ-FISC-030+ — ingestão CSV PGDASD (Sprint 3)
