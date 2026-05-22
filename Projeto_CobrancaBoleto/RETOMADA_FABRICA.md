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
| **Sprint M — BB + C6 + portal dinâmico** | — | **← PRÓXIMO** |

**Testes:** `npm test` 236+ · `portal:test` 33 · CI `quality:gate`

**Branch fábrica:** `feat/sprint-m-gateway-fase2` ← `main`

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
| M.2 | Adapter **Banco do Brasil** (sandbox) |
| M.3 | Adapter **C6** (flag off ou sandbox se PO liberar) |
| M.4 | API troca gateway + histórico |
| M.5 | Portal — formulário dinâmico de credenciais |
| M.6 | Testes + smoke BB |

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

---

## 8. SYSTEM PROMPT (colar no Cursor)

```
Repositório: cobranca-saas-api. main atualizado (Sprint L #20 + #21).
Sprint M ATUAL: BB adapter + portal credenciais dinâmicas + gateway_change_log.
Branch: feat/sprint-m-gateway-fase2
Pacote: Projeto_CobrancaBoleto/DEMANDA_SPRINT_M_GATEWAY_FASE2.md
Governança: IA abre PR; Tech Lead merge. C6 desligado por flag até credenciais PO.
```
