# Sprint 4 — Processamento fiscal + SERPRO mock

**Cards:** EXEQ-FISC-040 (client SERPRO parcial), EXEQ-FISC-050/051/052  
**Branch:** `feature/EXEQ-FISC-050-processamento-serpro`

## Entregáveis

- Migration `035_processamento_fiscal.sql` — `fiscal.processamento_fiscal` + `fiscal.processamento_evento`
- Módulo `fiscal-processamento` — criar processamentos a partir de ingest VALIDADO
- Módulo `serpro-integra-contador` — client mock/HTTP + OAuth cache
- Fila BullMQ `fiscal-serpro-transmit` (fallback síncrono sem Redis)
- APIs portal:
  - `POST /v1/portal/fiscal/processamentos` `{ fiscal_ingest_id }`
  - `GET /v1/portal/fiscal/processamentos`
  - `GET /v1/portal/fiscal/processamentos/:id` (+ timeline eventos)

## Verificação fábrica

```powershell
npm run verify:sprint4
```

**DoD:** 3 unit + 2 integração — ingest VALIDADO → processamento → status `TRANSMITIDA` (mock SERPRO).

## Flags

| Variável | Default | Efeito |
|----------|---------|--------|
| `FISCAL_GUIAS_ENABLED` | — | Rotas fiscal montadas |
| `FISCAL_SERPRO_MOCK` | `true` fora de prod | Transmissão mock (protocolo `MOCK-DECL-*`) |
| `FISCAL_SERPRO_ENABLED` | `false` | Live SERPRO na org (requer `fiscal.serpro_config`) |

## Próximo (S5)

- EXEQ-FISC-022 — alertas expiração certificado
- EXEQ-FISC-023 — procuração SERPRO
- Recibo `CONSDECREC15`, emit DAS `GERARDAS12`, link `guia_fiscal_id`
