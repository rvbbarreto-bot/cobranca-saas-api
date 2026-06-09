# Checklist homologação SERPRO (EXEQ-FISC-001)

**Sem secrets neste arquivo.** Credenciais em vault local / `.env` não commitado.

---

## 1. Pré-requisitos comerciais

- [ ] CNPJ contratante Exeq definido (PO)
- [ ] Processo aberto na [Loja SERPRO](https://loja.serpro.gov.br/)
- [ ] Produto: **Integra Contador**
- [ ] Ambiente **demonstração** habilitado

---

## 2. Credenciais (armazenar fora do Git)

Local sugerido: `docs/jira-import/.env.jira.local` (Jira) ou `.env.serpro.local` (criar):

```env
SERPRO_BASE_URL=https://gateway.apiserpro.serpro.gov.br
SERPRO_CONSUMER_KEY=
SERPRO_CONSUMER_SECRET=
SERPRO_CONTRATANTE_CNPJ=
SERPRO_AMBIENTE=demo
```

- [ ] Consumer Key obtido
- [ ] Consumer Secret obtido
- [ ] Token OAuth testado

---

## 3. Spike técnico

```powershell
# Dry-run (sem credenciais)
node scripts/serpro-demo-spike.mjs --dry-run

# Com credenciais em .env.serpro.local
node scripts/serpro-demo-spike.mjs
```

Serviço alvo demo: `PGDASD` / `CONSULTIMADECREC14` (consulta última declaração/recibo).

- [ ] Script executado
- [ ] Evidência JSON em `docs/evidencias/sprint-0/serpro-spike-*.json`

---

## 4. E2E automatizado (EXEQ-FISC-090)

```powershell
npm run migrate && npm run seed:dev
$env:RUN_FISCAL_SERPRO_HOMOLOG_E2E="1"
npm run fiscal:serpro:homolog:e2e
```

Fluxo: CSV PGDASD mock → `TRANSDECLARACAO11` → recibo PDF → `GERARDAS12` → download DAS.

- [ ] Script `fiscal:serpro:homolog:e2e` executado
- [ ] Evidência JSON em `docs/evidencias/fiscal-serpro-homolog-e2e-*.json`
- [ ] Mock demo (default) ou live com `FISCAL_SERPRO_MOCK=false`

---

## 5. Playwright E2E portal (EXEQ-FISC-092)

```powershell
npm run portal:dev   # VITE_FISCAL_GUIAS_ENABLED=true
# API: FISCAL_GUIAS_ENABLED=true
npm run e2e:fiscal-portal
```

Fluxo UI: upload CSV → validação → stepper transmissão → download recibo/DAS.

- [ ] `npm run e2e:fiscal-portal` passa (mock API)
- [ ] Workflow opcional `fiscal-portal-e2e.yml` verde

---

## 6. Plano B (se credenciais atrasarem)

- [ ] ADR aprovado com mocks (`FISCAL_SERPRO_MOCK=1`)
- [ ] Fixtures JSON em `tests/fixtures/serpro/`
- [ ] Data prevista credenciais: ___________
- [ ] Owner: PO + Comercial

---

## 7. Referências

- [Integra Contador — documentação](https://apicenter.estaleiro.serpro.gov.br/documentacao/api-integra-contador/)
- [Catálogo PGDASD](https://apicenter.estaleiro.serpro.gov.br/documentacao/api-integra-contador/pt/catalogo_de_servicos/)

---

*Atualizar checkboxes conforme progresso S0.*
