# Runbook — deploy feature flag fiscal SERPRO (EXEQ-FISC-093)

Guia operacional para ligar o módulo fiscal PGDASD/SERPRO em produção. **Sem secrets neste arquivo.**

---

## 1. Variáveis de ambiente (API)

| Variável | Dev/homolog | Produção |
|----------|-------------|----------|
| `FISCAL_GUIAS_ENABLED` | `true` | `true` |
| `FISCAL_SERPRO_ENABLED` | `true` | `true` |
| `FISCAL_SERPRO_MOCK` | `true` (default implícito) | **`false` obrigatório** |
| `FISCAL_SERPRO_REQUIRE_PROCURACAO` | `false` em E2E | `true` recomendado |
| `ENCRYPTION_KEY` | hex 64 chars | hex 64 chars (**obrigatório**) |
| `FISCAL_PDF_STORAGE` | `local` ou S3 futuro | conforme infra |
| `ENABLE_MOCK_AUTH` | opcional | **`false`** |

Credenciais SERPRO (**consumer key/secret**, CNPJ contratante, ambiente demo/prod) **não** vão no `.env` da API. São gravadas cifradas por organização em `fiscal.serpro_config` via portal **Configurações → Fiscal → SERPRO**.

Portal web (build estático):

```env
VITE_FISCAL_GUIAS_ENABLED=true
```

---

## 2. Checklist pré-deploy

```powershell
# 1. Validar ambiente de produção (bloqueia mock SERPRO, placeholder ENCRYPTION_KEY, etc.)
$env:NODE_ENV="production"
$env:FISCAL_GUIAS_ENABLED="true"
$env:FISCAL_SERPRO_ENABLED="true"
$env:FISCAL_SERPRO_MOCK="false"
$env:ENCRYPTION_KEY="<openssl rand -hex 32>"
npm run check:prod-env -- --strict

# 2. Readiness completo (DB + schema)
npm run check:readiness

# 3. Testes contrato SERPRO (CI local, sem credenciais reais)
npm run test:fiscal-serpro
```

- [ ] `check:prod-env --strict` verde com flags fiscais de produção
- [ ] `ENCRYPTION_KEY` gerada com `openssl rand -hex 32` e armazenada no cofre do deploy
- [ ] Consumer key/secret SERPRO configurados no portal para cada escritório piloto
- [ ] Procuração e certificado digital do cliente validados (portal)
- [ ] Migrações aplicadas (`npm run migrate`)

---

## 3. Sequência de rollout (feature flag)

1. **Deploy API** com flags desligadas (`FISCAL_GUIAS_ENABLED=false`) — smoke test health.
2. **Deploy portal** com `VITE_FISCAL_GUIAS_ENABLED=false` — usuários não veem menu fiscal.
3. **Piloto interno:** ligar API `FISCAL_GUIAS_ENABLED=true`, `FISCAL_SERPRO_ENABLED=true`, `FISCAL_SERPRO_MOCK=false`; portal `VITE_FISCAL_GUIAS_ENABLED=true` apenas para tenant piloto (módulo habilitado na plataforma Exeq).
4. **Validar fluxo:** upload CSV PGDASD → transmissão → recibo PDF → emissão DAS.
5. **Expandir** para demais escritórios após evidência em `docs/evidencias/`.

Homologação automatizada antes do go-live:

```powershell
npm run migrate && npm run seed:dev
$env:RUN_FISCAL_SERPRO_HOMOLOG_E2E="1"
npm run fiscal:serpro:homolog:e2e
```

Ver também: [SERPRO_HOMOLOG_CHECKLIST.md](../SERPRO_HOMOLOG_CHECKLIST.md) · [FISCAL_GO_LIVE_CHECKLIST.md](../FISCAL_GO_LIVE_CHECKLIST.md).

---

## 4. Rollback

Ordem recomendada (efeito imediato, sem revert de código):

1. `FISCAL_SERPRO_ENABLED=false` — para novas transmissões SERPRO.
2. `FISCAL_GUIAS_ENABLED=false` — desliga rotas `/v1/portal/fiscal/*` (404 controlado).
3. Portal: `VITE_FISCAL_GUIAS_ENABLED=false` e redeploy do front.
4. Se necessário isolar tenant: desabilitar módulo fiscal na plataforma Exeq (`/v1/exeq/escritorios/:id/modules`).

Jobs BullMQ em fila continuam até esvaziar; monitorar fila antes de rollback em horário de pico.

---

## 5. CI (GitHub Actions)

Job principal `CI` inclui:

- `check:prod-env --strict` (baseline + cenário fiscal SERPRO live)
- `npm run test:fiscal-serpro` — fixtures em `tests/fixtures/serpro/`, mock client, políticas de env

Workflow opcional Playwright: `.github/workflows/fiscal-portal-e2e.yml` (EXEQ-FISC-092).

---

## 6. Referências

- [ADR_SERPRO_FISCAL_MVP.md](../ADR_SERPRO_FISCAL_MVP.md)
- [SERPRO_HOMOLOG_CHECKLIST.md](../SERPRO_HOMOLOG_CHECKLIST.md)
- Fixtures contrato: `tests/fixtures/serpro/`
- Política env: `src/platform/config/fiscal-serpro-prod-env.ts`

---

*EXEQ-FISC-093 — DevOps secrets SERPRO + CI job fiscal.*
