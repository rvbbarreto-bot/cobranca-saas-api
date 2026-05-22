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
| Sprint J — CI Asaas manual | #17+ | Concluído |
| Playwright E2E + n8n JSON | #18–#19 | Concluído |
| **Sprint L — Gateway universal (Inter/Cora)** | — | **← PRÓXIMO** |

**Testes:** `npm test` 220+ · `portal:test` 33 · CI `quality:gate`

**Branch fábrica:** `feat/sprint-j-ci-asaas-e2e` ← `main`

---

## 2. Gate de entrada

```bash
git fetch origin && git checkout main && git pull origin main
git checkout -b feat/sprint-j-ci-asaas-e2e
npm ci && npm run build && npm test && npm run quality:gate
```

---

## 3. Implementado (não refazer)

- API + portal, inbox, n8n (6 eventos), E2E runner Sprint H, auth FASE2 A
- `main` alinhado à integração (Sprint I)

---

## 4. Trabalho imediato — Sprint L

**Pacote:** [DEMANDA_SPRINT_L_UNIVERSAL_GATEWAY.md](./DEMANDA_SPRINT_L_UNIVERSAL_GATEWAY.md)  
**Pesquisa (somente leitura):** [ESTUDO_APIS_BANCARIAS.md](./ESTUDO_APIS_BANCARIAS.md) · **Arquitetura:** [LLD_REVISADO_v2.md](./LLD_REVISADO_v2.md)

| # | Item |
|---|------|
| L.0 | Tipos `GatewayCredentials`, `ChargeEmissionContext` |
| L.1 | `mtls-agent`, `oauth-token-cache`, `provider-registry` |
| L.2 | `getGatewayForTenant()` + remover `new AsaasAdapter` no worker |
| L.3 | Migration `025_gateway_credentials_universal.sql` |
| L.4 | Adapters **Inter** + **Cora** (sandbox) |
| L.5 | `payment-emission-processor` + `charge-sync-reconciliation` |

### Backlog pós–Sprint L (Sprint M)

- BB + C6 Bank adapters — ver ESTUDO §10

---

## 5. Ordem de execução

```
feat/sprint-l-universal-gateway → quality:gate → PR → homolog sandbox Inter/Cora
```

---

## 6. Regras absolutas

Multi-tenant · RLS · inbox dedup · n8n noop sem URL · **nunca** commitar `ASAAS_API_KEY` nem JSON E2E real.

---

## 7. Documentação

| Doc | Uso |
|-----|-----|
| [DEMANDA_SPRINT_J_CI_ASAAS_E2E.md](./DEMANDA_SPRINT_J_CI_ASAAS_E2E.md) | **Atual** |
| [docs/evidencias/README.md](../docs/evidencias/README.md) | CI manual |

---

## 8. SYSTEM PROMPT (colar no Cursor)

```
Repositório: cobranca-saas-api. main atualizado (Sprint I #16).
Sprint J ATUAL: workflow_dispatch Asaas E2E + docs + teste YAML.
Branch: feat/sprint-j-ci-asaas-e2e
Pacote: DEMANDA_SPRINT_J_CI_ASAAS_E2E.md
Governança: IA abre PR; Tech Lead merge e configura ASAAS_API_KEY.
```
