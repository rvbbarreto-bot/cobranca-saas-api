# API Cobrança / Portal / Inbox

Pacote extraído do repositório **Projeto_EmissaoNF** (desenvolvimento: portal boletos, clientes, webhooks, máquina de estados, job `process-webhook-pending`).

## Retomada da fábrica (PO + Tech Lead)

**Documento mestre:** [Projeto_CobrancaBoleto/RETOMADA_FABRICA.md](./Projeto_CobrancaBoleto/RETOMADA_FABRICA.md) — snapshot, prioridades e gates. **Briefing fábrica (Maio 2026):** [PROMPT_FABRICA_ATUALIZACAO_MAIO2026.md](./Projeto_CobrancaBoleto/PROMPT_FABRICA_ATUALIZACAO_MAIO2026.md).

## Pré-requisitos

- Node.js 20+
- PostgreSQL: guia passo a passo de **banco novo** e **`.env`** em [SETUP_POSTGRES_E_ENV.md](./SETUP_POSTGRES_E_ENV.md).
- Migrações: `npm run migrate` aplica `db/migrations/*.sql` em ordem lexicográfica (`000` … `010`; o `000` é stub opcional de `automacao` em banco dedicado só à cobrança).

## Comandos

```bash
npm install
npm run check
npm run build
npm test
npm run migrate        # requer DATABASE_URL
npm run check:readiness  # variaveis (strict) + ping DB + schema minimo
npm run seed:dev       # happy path portal + billing_link -> tenant demo (requer DATABASE_URL)
npm run job:webhook-inbox
npm run test:integration   # integracao + bateria funcional (requer DATABASE_URL)
npm run test:stress:portal-clientes  # stress POST clientes (requer DATABASE_URL)
npm run quality:gate       # build + test + portal:test + test:integration (DATABASE_URL)
npm run test:functional    # somente tests/functional/api-battery.integration.test.ts
npm run portal:dev         # SPA portal (Vite) — ver apps/portal-web
npm run portal:build
npm run portal:test        # testes Vitest do portal
# Vitest forca NODE_ENV=test e `tests/setup/vitest-setup.ts` liga mocks mesmo com ENABLE_MOCK_AUTH=false no .env local.
```

Escopo MVP + portal web (`apps/portal-web`): [docs/MVP_ESCOPO_CONGELADO.md](./docs/MVP_ESCOPO_CONGELADO.md) e [docs/PORTAL_WEB.md](./docs/PORTAL_WEB.md). **Fase 2 (kickoff + qualidade):** [docs/FASE2_KICKOFF_QUALIDADE.md](./docs/FASE2_KICKOFF_QUALIDADE.md); verificação local agregada: `npm run quality:gate`.

Contrato HTTP, smoke e checklist: [docs/API_CONTRATO_E_SMOKE.md](./docs/API_CONTRATO_E_SMOKE.md).

CI (GitHub Actions): [`.github/workflows/ci.yml`](./.github/workflows/ci.yml) — `build`, `test`, `migrate`, `check:readiness`, `test:integration`, `test:stress:portal-clientes`.

Endurecimento de producao (passo a passo + checklist release): [docs/PRODUCAO_ENDURECIMENTO_PASSO_A_PASSO.md](./docs/PRODUCAO_ENDURECIMENTO_PASSO_A_PASSO.md). Valide o ambiente com `npm run check:readiness` (equivale a `check:prod-env --strict` + `check:db`) apos carregar `.env` ou variaveis do pipeline.

## Diferença em relação ao monólito origem

- `src/app.ts` **não** monta `/internal/fiscal` (motor NFS-e permanece no repo EmissaoNF).

## Variáveis

Ver `.env.example`.
