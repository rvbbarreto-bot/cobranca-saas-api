# Sprint 10 — Hardening go-live fiscal (EXEQ-FISC-095)

**Cards:** EXEQ-FISC-095

## Entregáveis

- Rate limit `POST /v1/portal/fiscal/ingest/csv` (10 req/min por tenant+usuário)
- Rollback operacional via `FISCAL_SERPRO_ENABLED=false` (503 em transmissão) e `FISCAL_GUIAS_ENABLED=false` (404 rotas)
- Jobs SERPRO respeitam `isFiscalSerproEnabled()`
- Checklist go-live: `docs/FISCAL_GO_LIVE_CHECKLIST.md`
- Testes: `tests/fiscal-guias/fiscal-go-live-hardening.integration.test.ts`

## Verificação fábrica

```powershell
npm run verify:sprint10
```

DoD: unit + integração rollback + `test:fiscal-serpro` (ENCRYPTION_KEY policy).
