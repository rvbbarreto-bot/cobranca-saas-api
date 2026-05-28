# Autorização de início de desenvolvimento — pós Sprint K

**De:** Ricardo Barreto (PO + Lead Tech)  
**Para:** Fábrica Sênior Full-Stack  
**Data:** 28/05/2026  
**Status:** ✅ **APROVADO PARA EXECUÇÃO IMEDIATA**

---

## 1. Registro de merge (gate encerrado)

| Item | Evidência |
|------|-----------|
| **PR #28** — Sprint K (DLQ, SLI, admin API, `e2e-asaas.yml`) | **MERGED** em `main` |
| Merge commit | `e734aad` |
| Branch | `feat/sprint-k-ops-foundation` (pode ser apagada após sync local) |

**Gates Sprint K considerados atendidos para produto:**

- G1 (trunk): `main` contém Sprint I (#16) + Sprint K (#28)
- Fundação operacional: DLQ, `/v1/admin/queues/status`, `/v1/admin/metrics/sli`, `GatewayError.retryable`

---

## 2. O que a fábrica deve fazer agora (ordem)

### Passo 0 — Sincronizar ambiente (obrigatório, dia 1)

```bash
git fetch origin
git checkout main && git pull origin main
npm ci && npm run migrate && npm run seed:dev
npm run build && npm test && npm run portal:test && npm run quality:gate
```

**Trunk único:** `main` @ `e734aad` ou posterior. **Não** ramificar de `feat/sprint1-payment-emission-portal`.

### Passo 1 — Próximo pacote autorizado: **Sprint N — Fase 2 (Ondas B + 0 + D)**

| Prioridade | Onda | Branch sugerida | Pacote |
|------------|------|-----------------|--------|
| **P0** | **B** — PDF Inter via portal (mock HTTP) | `feat/p2-inter-pdf` | [DEMANDA_SPRINT_N_FASE2_ONDAS_B_D.md](./DEMANDA_SPRINT_N_FASE2_ONDAS_B_D.md) |
| **P0** | **D** — Webhook Inter produção/homolog | `feat/sprint-n-inter-webhook` | Idem |
| **P1** | **0** — QA humano + relatório homolog | processo PO/QA | [docs/QA_P2_POS_MERGE_CHECKLIST.md](../docs/QA_P2_POS_MERGE_CHECKLIST.md) |
| P2 | **C** — Relatórios (filtros data) | após B | Idem |
| Opcional | Onda A restante (Clientes/Config/Login polish) | `feat/sprint-n-portal-polish` | [DEMANDA_SPRINT_N_ENTREGA_PRODUTO.md](./DEMANDA_SPRINT_N_ENTREGA_PRODUTO.md) |

**Meta da entrega:** PDF Inter utilizável no portal (com mock onde cert sandbox falhar) + webhook Inter estável + evidência QA Onda 0.

### Passo 2 — Fora de escopo neste ciclo (não iniciar sem novo RFC PO)

- Reabrir Sprint I / branch `feat/sprint1-payment-emission-portal`
- Recorrência E2E completa (Sprint N backlog longo — pacote dedicado futuro)
- BB sandbox (Sprint O)
- Fallback automático cross-gateway (ADR-001 v1 = sem failover)

---

## 3. Decisões congeladas (continuam válidas)

| Decisão | Valor |
|---------|--------|
| Stack | Express + SQL migrations + Vite/React — **sem** NestJS/Prisma/Next |
| Gateway por tenant | `escritorio_config.gateway_provider` + factory universal (já em `main`) |
| Erros de gateway | `GatewayError` / `PaymentGatewayError` com `retryable` |
| Filas | Usar DLQ/admin API entregues no Sprint K para novos workers |
| Governança | IA abre PR; **Tech Lead merge** — [GOVERNANCA_FABRICA_COMMIT_PR.md](./GOVERNANCA_FABRICA_COMMIT_PR.md) G1–G8 |

---

## 4. Gates de aprovação (próximos)

| Gate | Quando | O que valida |
|------|--------|--------------|
| **G-N-B** | PR Onda B | PDF Inter no portal + testes mock |
| **G-N-D** | PR Onda D | Webhook Inter + testes integração |
| **G-N-0** | Relatório QA assinado | Checklist homolog PO |

Não é necessária nova autorização PO para **abrir PRs** dentro do pacote Sprint N Fase 2 acima.

---

## 5. Checkpoint operacional (recomendado — dia 3)

Validar em staging (pós-deploy `main`):

- [ ] `GET /v1/admin/queues/status` — filas com contadores
- [ ] `GET /v1/admin/metrics/sli` — 7 SLIs retornam JSON
- [ ] Actions → **E2E Asaas (manual)** — skip ou artefato OK

---

## 6. SYSTEM PROMPT (colar no Cursor)

```
Repositório: cobranca-saas-api
main @ e734aad+ (Sprint K #28 mergeado)

AUTORIZAÇÃO PO: desenvolvimento IMEDIATO — Sprint N Fase 2
Pacote: Projeto_CobrancaBoleto/DEMANDA_SPRINT_N_FASE2_ONDAS_B_D.md
Ondas P0: B (feat/p2-inter-pdf) + D (feat/sprint-n-inter-webhook) em paralelo se possível
Gate entrada: npm run quality:gate após git pull main
Governança: GOVERNANCA_FABRICA_COMMIT_PR.md — IA abre PR, TL merge
Não usar feat/sprint1-payment-emission-portal
Sprint K (DLQ/SLI) — não refazer; usar admin API e classifyJobError
```

---

*Assinatura digital: Ricardo Barreto — PO + Lead Tech · CobrançaSaaS v2*
