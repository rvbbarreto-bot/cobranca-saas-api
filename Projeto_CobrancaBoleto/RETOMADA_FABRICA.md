# Retomada da fábrica — SaaS Cobranças (PO + Tech Lead)

**Emissão:** Maio 2026 · **Repositório:** `cobranca-saas-api`  
**Operação diária:** este arquivo + [PROMPT_FABRICA_ATUALIZACAO_MAIO2026.md](./PROMPT_FABRICA_ATUALIZACAO_MAIO2026.md)

---

## 1. Onde estamos (snapshot)

| Marco | PR | Status |
|-------|-----|--------|
| Sprints B–F | #6–#11 | Concluído |
| Sprint G–H, FASE2 A | #12–#15 | Concluído |
| Sprint I — `main` consolidado | #16 | Concluído |
| Sprint J — CI Asaas manual | #17 | Concluído |
| Playwright E2E + n8n JSON | #18–#19 | Concluído |
| Sprint L — docs gateway universal | #20 | Concluído |
| Sprint L — factory + Inter/Cora | #21 | Concluído |
| **Sprint M — C6 + portal dinâmico + homolog** | [#22](https://github.com/rvbbarreto-bot/cobranca-saas-api/pull/22) | **Concluído** |
| **P2.2 endereço pagador (emissão)** | — | **Em desenvolvimento** → `feat/p2-inter-payer-address` |

**Testes:** `npm test` · `portal:test` · CI `quality:gate`

**Branch fábrica:** `feat/p2-inter-payer-address` ← `main`

---

## 2. Gate de entrada

```bash
git fetch origin && git checkout main && git pull origin main
git checkout -b feat/sprint-m-gateway-fase2
npm ci && npm run migrate && npm run seed:dev
npm run build && npm test && npm run portal:test
npm run quality:gate
```

---

## 3. Implementado (não refazer)

- Gateway universal L: `getGatewayForTenant`, adapters **Asaas / Inter / Cora**, migration 025, worker + charge-sync via factory
- API portal: `GET /gateway/providers`, `PATCH /config` com `gateway_credentials`
- Docs: [docs/GATEWAY_UNIVERSAL.md](../docs/GATEWAY_UNIVERSAL.md), [DEMANDA_SPRINT_L_UNIVERSAL_GATEWAY.md](./DEMANDA_SPRINT_L_UNIVERSAL_GATEWAY.md)

---

## 4. Trabalho imediato — Sprint M

**Pacote:** [DEMANDA_SPRINT_M_GATEWAY_FASE2.md](./DEMANDA_SPRINT_M_GATEWAY_FASE2.md)  
**Pesquisa:** [ESTUDO_APIS_BANCARIAS.md](./ESTUDO_APIS_BANCARIAS.md) §4–§5

| # | Item |
|---|------|
| M.0 | Registry BB/C6 + loaders na factory |
| M.1 | Migration `026_gateway_change_log.sql` |
| M.2 | ~~BB~~ → **sprint futura** (credenciais sandbox PO) |
| M.3 | Adapter **C6** (PO: implementar agora) |
| M.4 | API troca gateway + histórico |
| M.5 | Portal — formulário dinâmico de credenciais |
| M.6 | Testes + smoke BB |

### Inter (Sprint L #21) — auditoria rápida

| Área | Status |
|------|--------|
| Adapter mTLS + OAuth + `POST/GET /cobrancas/v2` | ✅ |
| Factory + worker + charge-sync | ✅ |
| API portal `gateway_credentials` + providers | ✅ |
| PIX dedicado | ✅ `not_supported` (esperado) |
| URL boleto/PDF | ⚠️ placeholder `inter://...` (sem `GET /pdf`) |
| Portal UI credenciais Inter | ⚠️ só API — **M.5** resolve |
| Smoke E2E Inter | ⚠️ script stub |
| Webhooks Inter | ❌ Sprint N |

**Conclusão:** Inter **implementado para emissão técnica** (credenciais via PATCH + worker). Falta polish portal/PDF/homolog sandbox.

### Decisões PO (Sprint M)

- **BB:** outra sprint · **C6:** implementar · **Troca gateway:** permitir com log

### Backlog pós–Sprint M (Sprint N)

- Estorno `estornada`, normalização webhooks multi-banco, polling — ver ESTUDO §10

---

## 5. Ordem de execução

```
feat/sprint-m-gateway-fase2 → quality:gate → PR → homolog sandbox BB
```

---

## 6. Regras absolutas

Multi-tenant · RLS · credenciais cifradas · **nunca** commitar PEM/API keys · C6 só com doc/credenciais PO.

---

## 7. Documentação

| Doc | Uso |
|-----|-----|
| [DEMANDA_SPRINT_M_GATEWAY_FASE2.md](./DEMANDA_SPRINT_M_GATEWAY_FASE2.md) | **Atual** |
| [DEMANDA_SPRINT_L_UNIVERSAL_GATEWAY.md](./DEMANDA_SPRINT_L_UNIVERSAL_GATEWAY.md) | Referência L (concluído) |
| [docs/GATEWAY_UNIVERSAL.md](../docs/GATEWAY_UNIVERSAL.md) | Arquitetura |
| [docs/QA_HOMOLOG_INTER_GATEWAY_PORTAL.md](../docs/QA_HOMOLOG_INTER_GATEWAY_PORTAL.md) | **Homologação Inter (PO/QA)** |

---

## 8. SYSTEM PROMPT (colar no Cursor)

```
Repositório: cobranca-saas-api. main atualizado (Sprint L #20 + #21).
Sprint M ATUAL: C6 adapter + portal dinâmico + gateway_change_log (troca permitida com log).
BB: OUTRA SPRINT. Branch: feat/sprint-m-gateway-fase2
Pacote: Projeto_CobrancaBoleto/DEMANDA_SPRINT_M_GATEWAY_FASE2.md
Inter: emissão OK (#21); portal/PDF/smoke = M.5 ou P2.
```
