# Pacote de demandas — Sprint H: Homologação Asaas (E2E + evidências Sprint 1)

**Emitido por:** Tech Lead · **Para:** Fábrica (IA + dev)  
**Data:** Maio 2026 · **Base:** `main` após merge PR #12 (Sprint G — `charge.emitted`)  
**Prioridade:** P1 homolog PO · **Branch sugerida:** `feat/sprint-h-homolog-asaas-evidencia`

---

## Gate de entrada

```bash
git fetch origin && git checkout main && git pull origin main
git checkout -b feat/sprint-h-homolog-asaas-evidencia
npm ci && npm run migrate && npm run seed:dev
npm run build && npm test && npm run portal:test && npm run quality:gate
```

**Governança:** [GOVERNANCA_FABRICA_COMMIT_PR.md](./GOVERNANCA_FABRICA_COMMIT_PR.md) — IA faz commit + PR + handoff; **Tech Lead** faz merge.

**Pré-requisitos:** Sprints B–G mergeadas; runner E2E já existe (`npm run e2e:asaas:evidence`, `src/dev/asaas-sandbox-e2e-runner.ts`).

---

## Contexto

O PO exige **aceite Sprint 1** com evidências objetivas no Asaas Sandbox: emissão real, vínculo `provider_charge_id`, webhook, idempotência e checklist preenchível.

Hoje já existem:

- Script: `scripts/e2e-asaas-sandbox-evidence.ts` → JSON em `docs/evidencias/`
- Guia: [docs/ASAAS_SANDBOX_E2E.md](../docs/ASAAS_SANDBOX_E2E.md)
- Checklist: [docs/evidencias/SPRINT1_ACEITE_CHECKLIST.md](../docs/evidencias/SPRINT1_ACEITE_CHECKLIST.md)
- Vitest opt-in: `RUN_ASAAS_E2E=1` + `npm run test:integration:asaas`

**Objetivo Sprint H:** fechar o **pacote de homologação** — runner alinhado aos 13 critérios, testes unitários/funcionais sem depender de API key no CI padrão, template de evidência redigida, checklist utilizável pelo PO.

**Fora de escopo:** produção Asaas live; NFS-e; merge pela IA; commit de `ASAAS_API_KEY` ou JSON com segredos.

---

## Entregas (checklist)

### H.1 — Runner E2E ↔ checklist (13 critérios)

| Arquivo | Ação |
|---------|------|
| `src/dev/asaas-sandbox-e2e-runner.ts` | Garantir **uma assertion nomeada por critério** do checklist (ver tabela H.1.1); mensagens `detail` claras |
| `docs/evidencias/SPRINT1_ACEITE_CHECKLIST.md` | Coluna **Assertion runner** + instruções de preenchimento pós-`e2e:asaas:evidence` |

#### H.1.1 — Mapeamento critério → assertion

| # Checklist | Assertion (nome estável) |
|-------------|--------------------------|
| 1 | `ambiente_asaas_sandbox` (URL sandbox, key presente) |
| 2 | `cobranca_criada_asaas` (`gateway_transaction_id`) |
| 3 | `vinculo_interno_asaas` (`provider_charge_id`) |
| 4 | `identificador_externo` (`idempotency_key` / `externalReference`) |
| 5 | `webhook_inbox_inserido` |
| 6 | `webhook_idempotente_sem_evento_duplicado` |
| 7 | `charge_event_emissao` + `charge_event_webhook` |
| 8 | `payment_transaction_com_raw` |
| 9 | `correlation_id_rastreavel` (correlation no payload/steps) |
| 10 | `relatorio_sem_segredos` (JSON sem API key; `databaseUrl` mascarado) |
| 11 | `env_nao_commitada` (nota no relatório + `.env.example`) |
| 12 | `evidencia_json_gerada` (`writeAsaasE2EEvidenceReport`) |
| 13 | `reproducivel_documentado` (`automatedTestsNote` + links docs) |

Critérios já cobertos pelo runner atual devem ser **renomeados** se necessário para bater com a tabela (evitar duplicata/confusão no PO).

### H.2 — Evidências no repositório (sem vazar secrets)

| Arquivo | Ação |
|---------|------|
| `.gitignore` | Ignorar `docs/evidencias/asaas-e2e-*.json` (exceto `*-EXAMPLE.redacted.json`) |
| `docs/evidencias/README.md` | Como gerar, o que anexar no PR de homolog, o que **não** commitar |
| `docs/evidencias/asaas-e2e-EXAMPLE.redacted.json` | Template **redigido** (estrutura real, valores fictícios) |

### H.3 — Testes unitários

| Arquivo | Casos |
|---------|--------|
| `tests/dev/asaas-e2e-evidence.test.ts` (novo) | `maskDbUrl`; `writeAsaasE2EEvidenceReport` grava JSON válido em tmp; lista de assertions mínima em objeto mock |

Extrair funções puras para `src/dev/asaas-e2e-evidence-utils.ts` se facilitar teste (sem over-engineering).

### H.4 — Testes funcionais (sem Asaas no CI padrão)

| Arquivo | Casos |
|---------|--------|
| `tests/functional/e2e-asaas-evidence-script.test.ts` (novo) | Subprocess `tsx scripts/e2e-asaas-sandbox-evidence.ts` **sem** `DATABASE_URL` → exit code 1 |
| Manter | `tests/inbox/webhook-inbox-idempotency.integration.test.ts` (regressão idempotência) |

**Não** incluir `test:integration:asaas` no `quality:gate` (requer sandbox key).

### H.5 — Documentação

| Doc | Ação |
|-----|------|
| [docs/ASAAS_SANDBOX_E2E.md](../docs/ASAAS_SANDBOX_E2E.md) | Seção **Homolog PO** + fluxo TL; referência Sprint G (`charge.emitted` validado em unit, opcional no E2E) |
| [DEPLOY_CHECKLIST.md](../docs/DEPLOY_CHECKLIST.md) | Item homolog: checklist Sprint 1 assinado antes de prod |

### H.6 — Execução sandbox (evidência real — fora do git)

Executor humano ou fábrica com `.env` local:

```bash
npm run e2e:asaas:evidence
```

Anexar no PR (descrição ou drive): print terminal + caminho do JSON gerado. **Não** commitar o JSON com dados reais.

### H.7 — PR + handoff

- `npm run quality:gate` verde (sem `RUN_ASAAS_E2E`)
- PR com Summary, Test plan, link checklist
- **Sem merge** (Tech Lead)

---

## Critérios de aceite

- [ ] 13 critérios do checklist mapeados 1:1 a assertions no runner
- [ ] `npm test` verde (inclui `tests/dev/asaas-e2e-evidence.test.ts`)
- [ ] `npm run test:integration` / bateria funcional verde com `DATABASE_URL`
- [ ] `docs/evidencias/asaas-e2e-*.json` ignorados pelo git; template EXAMPLE commitado
- [ ] PO consegue preencher [SPRINT1_ACEITE_CHECKLIST.md](../docs/evidencias/SPRINT1_ACEITE_CHECKLIST.md) só lendo JSON + guia

---

## Backlog pós-H

| Item | Tema |
|------|------|
| FASE2 A | Runbook `ENABLE_MOCK_AUTH` / JWT produção |
| CI opcional | `workflow_dispatch` job Asaas E2E (secrets no GitHub) |
