# Pacote de demandas — Sprint I: Consolidação `main` (release integração)

**Emitido por:** Tech Lead · **Para:** Fábrica (IA + dev)  
**Data:** Maio 2026 · **Base:** `feat/sprint1-payment-emission-portal` @ `ee4b8d8` (Sprints G–H + FASE2 A mergeados)  
**Prioridade:** P0 release · **PR:** `feat/sprint1-payment-emission-portal` → `main` (sem branch de feature adicional, salvo hotfix de conflito)

---

## Gate de entrada

```bash
git fetch origin
git checkout feat/sprint1-payment-emission-portal && git pull origin feat/sprint1-payment-emission-portal
npm ci && npm run migrate && npm run seed:dev
npm run build && npm test && npm run portal:test && npm run quality:gate
```

**Governança:** [GOVERNANCA_FABRICA_COMMIT_PR.md](./GOVERNANCA_FABRICA_COMMIT_PR.md) — IA abre PR; **Tech Lead** merge em `main`.

**Contexto:** `main` parou no merge Sprint F (#11). Toda a linha G, H, FASE2 A, SaaS billing, portal cliente, n8n, inbox e runbooks está na branch de integração. Sem este sprint, CI e clones em `main` ficam defasados.

**Fora de escopo:** novas features; merge pela IA; alterar histórico com force push.

---

## Entregas (checklist)

### I.1 — Release notes

| Arquivo | Ação |
|---------|------|
| [docs/RELEASE_NOTES_INTEGRACAO_MAIN.md](../docs/RELEASE_NOTES_INTEGRACAO_MAIN.md) | Criar: PRs #12–#15, migrations 023–024, breaking (remoção módulo NFS-e legado), comandos pós-merge |

### I.2 — Documentação fábrica

| Arquivo | Ação |
|---------|------|
| [RETOMADA_FABRICA.md](./RETOMADA_FABRICA.md) | FASE2 A concluída (#15); Sprint I = atual; backlog Sprint J |
| [PROMPT_FABRICA_ATUALIZACAO_MAIO2026.md](./PROMPT_FABRICA_ATUALIZACAO_MAIO2026.md) | Alinhar branch e próximo pacote |
| [PR_SPRINT_I_BODY.md](./PR_SPRINT_I_BODY.md) | Corpo do PR para colar / `gh pr create` |

### I.3 — Pull request → `main`

- **Base:** `main` · **Head:** `feat/sprint1-payment-emission-portal`
- Título sugerido: `Release: integração Sprints G–H + FASE2 A → main`
- Resolver conflitos se CI falhar (esperado: merge limpo; validar `ci.yml` e `.gitignore`)
- **Não** mergear pela IA

### I.4 — Verificação pós-abertura do PR

- [ ] GitHub Actions `CI` verde no PR
- [ ] `check:prod-env --strict` no job CI (introduzido FASE2 A)
- [ ] Handoff TL com link do PR e `RELEASE_NOTES`

### I.5 — Pós-merge (Tech Lead / PO — registro)

Após merge do PR Sprint I:

```bash
git checkout main && git pull origin main
npm ci && npm run migrate && npm run quality:gate
```

- Fábrica passa a ramificar `feat/*` a partir de `main` atualizado
- PO: homolog sandbox — [docs/evidencias/SPRINT1_ACEITE_CHECKLIST.md](../docs/evidencias/SPRINT1_ACEITE_CHECKLIST.md) (processo, não bloqueia merge técnico)

---

## Definition of Done

| # | Critério |
|---|----------|
| D1 | PR aberto sprint1 → `main` com Summary + Test plan |
| D2 | `RELEASE_NOTES_INTEGRACAO_MAIN.md` commitado na branch de integração |
| D3 | RETOMADA + PROMPT atualizados |
| D4 | CI verde no PR (ou conflitos resolvidos e CI reexecutado) |
| D5 | Handoff explícito ao Tech Lead (sem merge IA) |

---

## Próximo pacote (após Sprint I)

**Sprint J:** [DEMANDA_SPRINT_J_CI_ASAAS_E2E.md](./DEMANDA_SPRINT_J_CI_ASAAS_E2E.md) — `workflow_dispatch` para `e2e:asaas:evidence` com secrets no GitHub (opcional, não bloqueia produção).

---

## Referências

- PRs mergeados na integração: #12 (G), #14 (H), #15 (FASE2 A)
- Auth: [docs/RUNBOOK_AUTH_PRODUCAO.md](../docs/RUNBOOK_AUTH_PRODUCAO.md)
- Homolog: [docs/evidencias/README.md](../docs/evidencias/README.md)
