# Pacote de demandas — Sprint J: CI manual Asaas E2E (`workflow_dispatch`)

**Emitido por:** Tech Lead · **Para:** Fábrica (IA + dev)  
**Data:** Maio 2026 · **Base:** `main` após merge Sprint I  
**Prioridade:** P2 · **Branch sugerida:** `feat/sprint-j-ci-asaas-e2e`

---

## Gate de entrada

```bash
git fetch origin && git checkout main && git pull origin main
git checkout -b feat/sprint-j-ci-asaas-e2e
npm ci && npm run build && npm test && npm run quality:gate
```

**Pré-requisito:** Sprint I mergeado — `main` alinhado à integração.

**Governança:** IA abre PR; Tech Lead merge. Secrets **somente** no GitHub (Settings → Secrets).

---

## Contexto

O runner `npm run e2e:asaas:evidence` e o checklist Sprint 1 existem (Sprint H). O CI padrão **não** chama a API Asaas (sem key no repo). Este sprint adiciona um workflow **manual** para homologação repetível em pipeline.

**Fora de escopo:** rodar E2E Asaas em todo `push`/`pull_request`; commit de keys; merge pela IA.

---

## Entregas

### J.1 — Workflow GitHub Actions

| Arquivo | Ação |
|---------|------|
| `.github/workflows/asaas-e2e-manual.yml` | `on: workflow_dispatch`; inputs opcionais (ex. `skip_db`); job com Postgres+Redis como `ci.yml` |

Steps mínimos:

1. Checkout, Node 20, `npm ci`, `npm run build`, `npm run migrate`
2. Env: `ASAAS_API_KEY` ← `${{ secrets.ASAAS_API_KEY }}`, `DATABASE_URL`, `JWT_SECRET`, etc. (espelhar `.env.example` / CI)
3. `npm run e2e:asaas:evidence` (ou script documentado)
4. Upload artefacto: JSON redigido / log ( **não** falhar se secret ausente — job `if: secrets.ASAAS_API_KEY != ''` ou step condicional com mensagem clara)

### J.2 — Documentação

| Arquivo | Ação |
|---------|------|
| `docs/evidencias/README.md` | Secção “CI manual” — como disparar, secrets necessários, TTL artefactos |
| `docs/ASAAS_SANDBOX_E2E.md` | Link para workflow |

### J.3 — Testes (sem API real no CI padrão)

- Manter `tests/functional/e2e-asaas-evidence-script.test.ts` (exit sem DB)
- Opcional: teste que valida **estrutura YAML** do workflow (parse estático) se já houver padrão no repo

### J.4 — PR + handoff

- Documentar no PR quais secrets o TL deve criar: `ASAAS_API_KEY`, opcionalmente `ASAAS_WEBHOOK_ACCESS_TOKEN` se o runner exigir

---

## Definition of Done

- Workflow dispara manualmente no GitHub
- Com secret configurado, job completa e gera artefacto de evidência
- Sem secret, job informa skip (não quebra `main`)
- `npm test` + `quality:gate` verdes
- PR aberto; merge pelo Tech Lead

---

## Secrets sugeridos (Tech Lead)

| Secret | Uso |
|--------|-----|
| `ASAAS_API_KEY` | Sandbox Asaas |
| (opcional) demais vars do runner | Ver `scripts/e2e-asaas-sandbox-evidence.ts` e `.env.example` |
