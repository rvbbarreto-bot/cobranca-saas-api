# Sprint 5 — Certificados, procuração SERPRO, recibo/DAS, UX portal

**Cards:** EXEQ-FISC-022, EXEQ-FISC-023, EXEQ-FISC-060, EXEQ-FISC-061, UX processamentos

## Entregáveis backend

- **EXEQ-FISC-022** — Job diário `fiscal-certificate-expiry` (06h); status `expiring`; audit `certificado_expirando` (30/15/7 dias); `GET /certificados/expiring`
- **EXEQ-FISC-023** — `POST /procuracoes/validar-serpro` (`OBTERPROCURACAO41` mock/live); metadata `serpro_situacao`; bloqueio transmissão (`FISCAL_SERPRO_REQUIRE_PROCURACAO=true`)
- **EXEQ-FISC-060** — Fila `fiscal-serpro-recibo` (`CONSDECREC15` mock); `recibo_storage_key`; status `RECIBO_OK`
- **EXEQ-FISC-061** — Fila `fiscal-serpro-emit-das` (`GERARDAS12` mock); cria `guia_fiscal` + PDF; status `CONCLUIDO`; `guia_fiscal_id`
- **EXEQ-FISC-062 parcial** — `GET /processamentos/:id/recibo/url`

Migration: `036_fiscal_audit_serpro_actions.sql`

## Pipeline automático (mock)

`VALIDADO → TRANSMITIDA → RECIBO_OK → CONCLUIDO` encadeado após transmissão.

## Portal UX

- Menu **Processamentos PGDASD** (`/processamentos-fiscais`)
- Detalhe com stepper + download recibo/DAS + link guia
- Config. fiscal: banner certs expirando + botão validar procuração SERPRO

## Verificação fábrica

```powershell
npm run verify:sprint5
```

DoD: 2 unit + 1 integração E2E pipeline `CONCLUIDO` com procuração validada.
