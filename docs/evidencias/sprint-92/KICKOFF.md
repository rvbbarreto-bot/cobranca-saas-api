# Sprint 92 — Playwright E2E portal fiscal (EXEQ-FISC-092)

**Gate:** `npm run verify:sprint92`  
**CI:** `.github/workflows/fiscal-portal-e2e.yml`

## Fluxo validado

1. Login portal (seed `seed:fiscal-portal-e2e`)
2. Upload CSV PGDASD → validação
3. Iniciar transmissão → stepper 5 etapas (SERPRO mock)
4. Download recibo + PDF guia DAS

## Pré-requisitos locais

- `DATABASE_URL` (Postgres `:5434` ou `docker compose up -d postgres`)
- Playwright Chromium: `npm run e2e:playwright:install`
- O gate sobe API `:3335` e portal `:5175` (isolados do dev `:3333`/`:5173`)
