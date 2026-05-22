# Pacote de demandas — Sprint M: Gateway fase 2 (BB + C6 + portal dinâmico + troca de gateway)

**Emitido por:** Tech Lead · PO · Arquiteto  
**Para:** Fábrica (IA + dev)  
**Data:** Maio 2026 · **Base:** `main` (pós Sprint L — PR #20 docs, PR #21 código)  
**Prioridade:** P1 · **Estimativa:** 8–12 dias · **Branch sugerida:** `feat/sprint-m-gateway-fase2`  
**Pré-requisito:** [DEMANDA_SPRINT_L_UNIVERSAL_GATEWAY.md](./DEMANDA_SPRINT_L_UNIVERSAL_GATEWAY.md) mergeado (#21)  
**Pesquisa HTTP:** [ESTUDO_APIS_BANCARIAS.md](./ESTUDO_APIS_BANCARIAS.md) §4 (C6), §5 (BB)  
**Arquitetura:** [LLD_REVISADO_v2.md](./LLD_REVISADO_v2.md) · [docs/GATEWAY_UNIVERSAL.md](../docs/GATEWAY_UNIVERSAL.md)

---

## Gate de entrada

```bash
git fetch origin && git checkout main && git pull origin main
git checkout -b feat/sprint-m-gateway-fase2
npm ci && npm run migrate && npm run seed:dev
npm run build && npm test && npm run portal:test
npm run quality:gate
```

**Governança:** [GOVERNANCA_FABRICA_COMMIT_PR.md](./GOVERNANCA_FABRICA_COMMIT_PR.md)

---

## Contexto — o que já existe (Sprint L)

| Item | Caminho | Estado |
|------|---------|--------|
| Factory | `get-gateway-for-tenant.ts` | ✅ Asaas, Inter, Cora |
| Registry | `provider-registry.ts` | BB/C6 com `enabled: false`, campos vazios |
| Migration 025 | `gateway_credentials_encrypted`, CHECK `inter`/`cora` | ✅ |
| Worker emissão | `payment-emission-processor.ts` | ✅ usa factory |
| Portal API | `GET .../gateway/providers`, `PATCH /config` + `gateway_credentials` | ✅ |
| Portal UI | `ConfiguracoesPage.tsx` | ⚠️ só `asaas` \| `pagarme` + api_key fixa |

**Regra:** não duplicar L.0–L.5; **estender** registry, factory loaders, migration 026, portal.

---

## Objetivo Sprint M (PO)

1. **Banco do Brasil** em sandbox: tenant com `gateway_provider=bb` emite boleto via worker.  
2. **C6 Bank:** adapter implementável quando PO entregar credenciais/doc oficial; até lá, código atrás de `GATEWAY_C6_ENABLED=false` + testes mock.  
3. **Portal:** formulário de credenciais **dinâmico** a partir de `GATEWAY_REGISTRY` (Inter, Cora, BB, Asaas).  
4. **Troca de gateway** com trilha de auditoria (`gateway_change_log`) — sem quebrar cobranças já emitidas.

**Fora de escopo Sprint M:** estorno `estornada` (Sprint N), contratos recorrentes, Pagarme adapter, webhooks normalizados multi-banco (Sprint N).

---

## M.0 — Registry e tipos (ajustes)

### M.0.1 — `provider-registry.ts`

| Provider | `authType` (corrigir) | `enabled` | Campos obrigatórios (JSON) |
|----------|----------------------|-----------|----------------------------|
| `bb` | `oauth_basic` (sem mTLS no token) | `GATEWAY_BB_ENABLED` | `client_id`, `client_secret`, `gw_app_key`, `numero_convenio`, `numero_carteira`, `numero_variacao_carteira` |
| `c6` | `oauth_client_secret` (sem mTLS OAuth; ver ESTUDO §4) | `GATEWAY_C6_ENABLED` (default **false**) | `client_id`, `client_secret`, `codigo_cedente` (+ campos que PO confirmar) |

- Corrigir `authType` de BB/C6: **não** usar `mtls_oauth` se o ESTUDO indicar OAuth sem mTLS no token.
- Expor `authType` na API `GET .../providers` para o portal renderizar UX (textarea PEM vs inputs texto).

### M.0.2 — Factory

**Modificar:** `get-gateway-for-tenant.ts`

```typescript
ADAPTER_LOADERS.bb = (ctx) => new BbAdapter(ctx);
ADAPTER_LOADERS.c6 = (ctx) => new C6BankAdapter(ctx);
```

---

## M.1 — Migration `026_gateway_change_log.sql`

**Criar:** `db/migrations/026_gateway_change_log.sql`

```sql
CREATE TABLE IF NOT EXISTS gateway_change_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  old_provider TEXT,
  new_provider TEXT NOT NULL,
  changed_by_user_id TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_gateway_change_log_tenant
  ON gateway_change_log (tenant_id, changed_at DESC);

-- CHECK escritorio_config: incluir bb, c6
ALTER TABLE escritorio_config DROP CONSTRAINT IF EXISTS escritorio_config_gateway_provider_check;
ALTER TABLE escritorio_config
  ADD CONSTRAINT escritorio_config_gateway_provider_check
  CHECK (gateway_provider IN ('asaas','pagarme','inter','cora','bb','c6'));

ALTER TABLE payment_transactions DROP CONSTRAINT IF EXISTS payment_transactions_gateway_check;
ALTER TABLE payment_transactions
  ADD CONSTRAINT payment_transactions_gateway_check
  CHECK (gateway IN ('asaas','pagarme','inter','cora','bb','c6'));
```

---

## M.2 — Adapter Banco do Brasil

**Pasta:** `src/modules/payment-gateway/infrastructure/bb/`

| Arquivo | Função |
|---------|--------|
| `bb-types.ts` | Payloads §5 ESTUDO |
| `bb-oauth.ts` | `Authorization: Basic`, scope `cobranca.registro-boletos`, TTL 600s, cache Redis margem 60s |
| `bb-http-client.ts` | Header `gw-dev-app-key` (sandbox) / `gw-app-key` (prod) em **todas** as chamadas |
| `bb-adapter.ts` | `PaymentGatewayAdapter` — `createCustomer` sintético; `createBoleto` → `POST /cobrancas/v2/boletos` |
| `bb-status-map.ts` | Mapear status BB → `mapGatewayChargeStatus` em `gateway-status-map.ts` |

**Persistir:** `charges.provider_charge_id` = identificador retornado pelo BB (campo conforme resposta sandbox).

**Testes:** `tests/payment-gateway/bb-adapter.test.ts` (mock HTTP, sem rede).

**Script:** `npm run gateway:smoke:bb` + `scripts/gateway-smoke-bb-sandbox.ts` (`RUN_BB_SANDBOX=1`).

---

## M.3 — Adapter C6 Bank

**Pasta:** `src/modules/payment-gateway/infrastructure/c6/`

| Situação | Ação fábrica |
|----------|----------------|
| PO **sem** credenciais/doc oficial | Implementar estrutura + `C6BankAdapter` que falha com `GatewayProviderError('pending_official_docs')` se `GATEWAY_C6_ENABLED` não estiver ativo; testes mock do contrato |
| PO **com** credenciais sandbox | Completar OAuth + emissão conforme doc oficial (substituir skeleton do ESTUDO §4) |

**Não bloquear** merge de M se C6 ficar desabilitado por flag — BB + portal são critérios mínimos de aceite.

---

## M.4 — Troca de gateway (API)

**Criar:** `src/modules/portal-read/application/change-gateway-provider.ts`

| Regra | Detalhe |
|-------|---------|
| Quem | `admin_escritorio` |
| Validação | `validateGatewayCredentials` antes de gravar |
| Efeito | `UPDATE escritorio_config.gateway_provider` + credenciais cifradas |
| Auditoria | `INSERT gateway_change_log` + `writeAuditLog` |
| Bloqueio | Opcional: recusar troca se existir cobrança `rascunho` em fila de emissão (documentar decisão no PR) |

**Rotas:**

| Método | Caminho | Função |
|--------|---------|--------|
| `PATCH` | `/v1/portal/escritorio/gateway` | Troca provider + `gateway_credentials` (body dedicado) |
| `GET` | `/v1/portal/escritorio/gateway/history` | Últimas N trocas (paginação simples) |

Manter `PATCH /config` compatível (legado).

---

## M.5 — Portal web (formulário dinâmico)

**Modificar:** `apps/portal-web/src/pages/ConfiguracoesPage.tsx` + `apps/portal-web/src/lib/api.ts`

| UX | Implementação |
|----|----------------|
| Select provider | `GET /v1/portal/escritorio/gateway/providers` |
| Campos dinâmicos | `GET .../providers/:id/schema` → render por `credentialFields` (`secret` → password/textarea) |
| Gravar | `PATCH /config` ou `PATCH /gateway` com `gateway_credentials: Record<string,string>` |
| Providers | asaas, inter, cora, bb (c6 só se enabled na API) |

**Testes:** atualizar `ConfiguracoesPage.test.tsx` — mock providers schema, submit com credentials.

**Não** commitar PEM reais nos testes.

---

## M.6 — Testes e DoD

```bash
npm run build
npm test
npm run portal:test
npm run quality:gate
```

### Matriz sprint done

| Provider | Unit adapter | Factory loader | Sandbox E2E (opt-in) |
|----------|--------------|----------------|----------------------|
| Asaas/Inter/Cora | regressão verde | — | — |
| **BB** | `bb-adapter.test.ts` | `provider=bb` | `RUN_BB_SANDBOX=1` |
| **C6** | mock ou sandbox | flag off default | quando PO liberar |

### Critérios de aceite (PO)

- [ ] Admin escolhe BB no portal, preenche campos do registry, salva credenciais cifradas.
- [ ] Cobrança `rascunho` → `emitida` com `gateway_provider=bb` (sandbox).
- [ ] Troca Asaas → Inter grava linha em `gateway_change_log` + audit.
- [ ] Inter/Cora/Asaas regressão sem alteração de `.env` de produção.
- [ ] Credenciais/certificados nunca em log claro.

---

## M.7 — Documentação

| Arquivo | Ação |
|---------|------|
| [docs/GATEWAY_UNIVERSAL.md](../docs/GATEWAY_UNIVERSAL.md) | BB, C6, troca gateway, diagrama |
| [RETOMADA_FABRICA.md](./RETOMADA_FABRICA.md) | Sprint M → concluído após PR |
| `.env.example` | `GATEWAY_BB_ENABLED`, `GATEWAY_C6_ENABLED`, comentários sandbox BB |

---

## M.8 — PR + handoff

- **Título:** `feat(gateway): BB adapter + portal dinâmico + gateway change log (Sprint M)`
- **Handoff Tech Lead:** credenciais sandbox BB no GitHub Secrets ou 1Password; C6 pendente de PO.

---

## Perguntas para o PO (bloquear C6 completo se ausente)

1. Credenciais sandbox **BB** (`client_id`, `client_secret`, `gw_app_key`, convênio/carteira)?  
2. Acesso ao portal **developers.c6bank.com.br** — quando?  
3. Troca de gateway com cobranças `emitida` pendentes — permitir ou exigir zerar fila?

**Defaults:** BB mock + sandbox manual; C6 desligado por flag; troca permitida com log.

---

## Sprint N (não implementar agora)

- Estado `estornada`, webhooks normalizados, polling agressivo — ver ESTUDO §10 e LLD Sprint N.

---

## Referências código (pós #21)

| Responsabilidade | Caminho |
|------------------|---------|
| Factory | `src/modules/payment-gateway/application/get-gateway-for-tenant.ts` |
| Registry | `src/platform/payment-gateway/provider-registry.ts` |
| Status sync | `src/modules/payment-gateway/domain/gateway-status-map.ts` |
| Portal router | `src/modules/portal-read/interfaces/http/escritorio-router.ts` |
| Config UI | `apps/portal-web/src/pages/ConfiguracoesPage.tsx` |

---

*Documento executável pela fábrica. Payloads HTTP → ESTUDO; ficheiros e fluxo → este documento.*
