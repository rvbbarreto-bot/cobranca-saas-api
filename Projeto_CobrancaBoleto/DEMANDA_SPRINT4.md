# 📦 PACOTE DE DEMANDAS — Sprint 4: SaaS Billing + n8n
## SaaS de Cobranças · Emitido por: PO + Tech Manager · Maio 2026
### Pré-requisito: Sprint 3 mergeado em `main` (portal cliente + relatórios)

---

> **Gate de entrada:** `npm test` ≥ 172 testes verdes · `validacao_sprint3.sh` 6/6 · CI verde em `main`.
> **Branch de trabalho:** `cursor/sprint4-saas-billing` (até merge do PR Sprint 4).
> **Kickoff retomada:** [RETOMADA_FABRICA.md](./RETOMADA_FABRICA.md)

---

## CONTEXTO PARA O AGENTE

```
Estado pós-Sprint 3 (main):
✅ Portal cliente (magic link, cobranças, dashboard, export CSV)
✅ E2E sprint3-e2e-flow.integration.test.ts no CI
✅ Filas: charges:emission, inbox:process, charges:sync, notifications:send

Sprint 4 — objetivo (spec v2):
  Cobrar escritórios por plano (básico / profissional / enterprise)
  Trial 14 dias no provisionamento
  Limites: max_clientes, max_cobrancas_mes
  Modo read-only quando assinatura vencer sem pagamento
  Integração futura com gateway de assinatura (Asaas subscription) + n8n

FORA DE ESCOPO: NFS-e (projeto separado)
```

---

## TAREFA 4.1 — Schema planos + assinaturas + uso mensal ✅ (em andamento)

**Migration `023_saas_billing_plans_subscriptions.sql`**

- Tabelas: `planos`, `assinaturas`, `tenant_usage_monthly`
- Seed: `basico`, `profissional`, `enterprise`
- Demo tenant: assinatura trial profissional

**Critérios de aceite:**
- [x] Migration idempotente
- [x] 3 planos no seed
- [x] `npm run migrate` em dev (validar em staging no PR)

---

## TAREFA 4.2 — Provisionamento com plano + trial

**Alterar `POST /v1/tenants/provision`**

Body opcional: `plano_slug` (default `basico`)

Ao criar tenant → `INSERT assinaturas` status=`trial`, `trial_ends_at = now() + 14 days`

**Critérios:**
- [x] Parse `plano_slug` / `planoSlug`
- [x] 400 se plano inexistente
- [ ] Teste integração provision + assinatura

---

## TAREFA 4.3 — APIs de consulta

| Método | Rota | Papel |
|--------|------|-------|
| GET | `/v1/saas/plans` | owner/admin (plataforma) |
| GET | `/v1/portal/escritorio/assinatura` | admin_escritorio |

Resposta assinatura inclui `plano`, `uso` (clientes, cobranças do mês), `read_only`.

**Critérios:**
- [x] Endpoints implementados
- [ ] 4+ testes unitários

---

## TAREFA 4.4 — Metering e enforcement

- Antes de `POST /v1/portal/cobrancas` → checar limite mensal + read_only
- Antes de `POST /v1/portal/clientes` → checar limite clientes + read_only
- Após cobrança criada → incrementar `tenant_usage_monthly`
- Job futuro: reconciliar uso com `COUNT(*)` charges do mês (opcional)

**HTTP:** 403 `SUBSCRIPTION_READ_ONLY` · 402 `LIMIT_*`

**Critérios:**
- [x] Enforcement em create charge / cliente
- [x] Testes `assert-tenant-can-mutate`

---

## TAREFA 4.5 — Plataforma MRR (backlog)

`GET /v1/saas/metrics` — MRR, tenants por status, inadimplência de planos.
Somente owner da plataforma.

---

## TAREFA 4.6 — n8n orchestration (backlog)

- Webhook outbound para eventos: `charge.paid`, `subscription.past_due`
- Documentar contrato em `docs/N8N_WEBHOOKS.md`
- Não bloquear billing core

---

## Ordem de execução

```
1. TAREFA 4.1 — migration 023
2. TAREFA 4.2 — provision + trial
3. TAREFA 4.3 — GET plans + assinatura
4. TAREFA 4.4 — limits + metering
5. validacao_sprint4.sh
6. TAREFA 4.5 / 4.6 — próximo PR
```

---

## Checklist PR Sprint 4 (fase 1)

```markdown
[x] Migration 023 aplicada
[x] Módulo src/modules/saas-billing/
[x] GET /v1/saas/plans
[x] GET /v1/portal/escritorio/assinatura
[x] Provision com plano_slug + trial 14d
[x] Limites em POST cobrancas e POST clientes
[x] npm run build ✅ + npm test ✅ (172 testes)
[x] validacao_sprint4.sh 6/6
[x] API_CONTRATO_E_SMOKE.md atualizado
[x] Teste integração provision + assinatura trial
[x] UI /escritorio — bloco assinatura/uso
```

*Referência: `Especificacao_Requisitos_SaaS_Cobrancas_v2.docx` §6.2 planos/assinaturas · US-21*
