# Sprint 3 — Ingestão CSV PGDASD (EXEQ-FISC-030/031/032)

**Branch:** `feature/EXEQ-FISC-030-csv-ingestion`  
**Autorização PO:** recomendação tech lead pós-merge S2 — caminho crítico MVP SERPRO

## Entregas

| Issue | Artefato |
|-------|----------|
| EXEQ-FISC-030 | `canonical-apuracao.schema.ts` + Zod |
| EXEQ-FISC-031 | `CsvIngestionAdapter` + registry (Excel/API stub Fase 2) |
| EXEQ-FISC-032 | `POST/GET /v1/portal/fiscal/ingest/*`, fila `fiscal-ingest-validate`, migration `034` |

## Comando fábrica

```powershell
npm run verify:sprint3
```

## DoD S3

- [x] Migration 034 `fiscal.fiscal_ingest`
- [x] Parser CSV template v1 + validações spec
- [x] API upload multipart + status VALIDANDO→VALIDADO|ERRO
- [x] Worker BullMQ (fallback sync sem Redis)
- [x] CI verde `verify:sprint3` (3 unit + 2 integração)
- [x] Evidência: `docs/evidencias/sprint-3/sprint3-verify-2026-06-07.json`
- [ ] PR merge

## Próximo (S4)

- EXEQ-FISC-040+ — cliente SERPRO + transmissão
- EXEQ-FISC-050 — `processamento_fiscal` entity
