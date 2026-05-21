# Pacote de demandas — Sprint C: Portal `/configuracoes`

**Emitido por:** Tech Lead · **Para:** Fábrica (IA + dev)  
**Data:** Maio 2026 · **Base:** `main` @ `36f3a42` (após PR #6 Sprint B)  
**Prioridade:** P1 · **Estimativa:** 5–8 dias · **Branch sugerida:** `feat/sprint-c-portal-configuracoes`

---

## Gate de entrada

```bash
git fetch origin && git checkout main && git pull origin main
git checkout -b feat/sprint-c-portal-configuracoes
npm ci && npm run migrate && npm run seed:dev
npm run build && npm test && npm run portal:test
```

**Governança:** [GOVERNANCA_FABRICA_COMMIT_PR.md](./GOVERNANCA_FABRICA_COMMIT_PR.md) — IA faz commit + PR + handoff; **Tech Lead** faz merge.

---

## Contexto

Sprint B entregou activate assinatura + paginação. A API de **configurações do escritório** já existe em `escritorio-router.ts`; o SPA ainda usa `PlaceholderPage` em `/configuracoes`.

**Objetivo Sprint C:** substituir o placeholder por UI funcional (admin_escritorio) consumindo a API existente, com testes e contrato HTTP documentado.

**Não refazer:** lógica de negócio em `escritorio-config-use-cases`, `charging-rules-use-cases`, `notification-templates-use-cases` salvo bug encontrado em review.

**Fora de escopo:** NFS-e, `/internal/fiscal`, orquestração n8n (Sprint D).

---

## API já disponível (consumir, não duplicar rotas)

Prefixo: `/v1/portal/escritorio` · **RBAC:** `admin_escritorio` (403 para operador/viewer).

| Método | Caminho | Uso na UI |
|--------|---------|-----------|
| GET | `/config` | Formulário gateway + fiscal (mascarado) |
| PATCH | `/config` | Salvar `gateway_provider`, `gateway_api_key`, `whatsapp_*`, campos fiscais |
| GET | `/regua` | Tabela de regras |
| POST | `/regua` | Nova regra |
| PATCH | `/regua/:ruleId` | Ativar/desativar, canal |
| DELETE | `/regua/:ruleId` | Remover regra |
| GET | `/templates` | Lista templates |
| PATCH | `/templates/:templateId` | Editar subject/body (não editar templates sistema `tenant_id` null) |
| GET | `/templates/:templateId/preview?charge_id=<uuid>` | Preview com cobrança real |

### PATCH `/config` — body (referência código)

Campos opcionais (ver `patchEscritorioConfigSchema` em `escritorio-config-use-cases.ts`):

- `cnpj_emissor`, `razao_social`, `inscricao_municipal`, `regime_tributario`, `codigo_municipio`, `aliquota_iss`
- `gateway_provider`: `asaas` | `pagarme`
- `gateway_api_key`: string ≥ 10 (criptografado no servidor; GET devolve mascarado)
- `whatsapp_provider`: `zapi` | `twilio`
- `whatsapp_token`: criptografado; GET mascarado

### POST `/regua` — body

```json
{ "days_offset": -3, "channel": "email", "template_id": "<uuid opcional>" }
```

`days_offset`: -30..30 · `channel`: `email` | `whatsapp` | `both` · **409** `duplicate_rule` se conflito.

### PATCH `/regua/:ruleId`

```json
{ "is_active": true, "channel": "whatsapp" }
```

### PATCH `/templates/:templateId`

```json
{ "subject": "Assunto", "body_template": "Olá {{nome}}, valor {{valor}}..." }
```

**422** `system_template_readonly` para templates globais.

---

## Tarefas (ordem sugerida)

### C.1 — Client API (`apps/portal-web/src/lib/api.ts`)

Funções tipadas + `ApiError`:

- `fetchEscritorioConfig` / `patchEscritorioConfig`
- `fetchChargingRules` / `postChargingRule` / `patchChargingRule` / `deleteChargingRule`
- `fetchNotificationTemplates` / `patchNotificationTemplate`
- `previewNotificationTemplate(templateId, chargeId)`

Testes em `api.test.ts` (mocks `fetch`, 2–3 casos por grupo).

### C.2 — Página `/configuracoes`

Substituir rota em `App.tsx` (remover `PlaceholderPage` para `/configuracoes`).

**Layout:** abas ou secções:

1. **Gateway e integrações** — GET/PATCH config; aviso se credencial mascarada (`****xxxx`); não reenviar api_key vazio se utilizador não alterou.
2. **Régua de cobrança** — tabela + formulário criar; toggle ativo; eliminar com confirmação.
3. **Templates** — lista; editar body/subject só em templates do tenant; preview com input `charge_id` (ou picker da última cobrança listada).

**UX mínima:**

- Loading / erro por secção
- Banner se `membership_role !== admin_escritorio` (só leitura ou mensagem)
- Mensagens 403, 409, 422 legíveis

### C.3 — Testes front

- `ConfiguracoesPage.test.tsx`: render abas; mock API; submit PATCH config (1 teste)
- Manter `npm run portal:test` verde

### C.4 — Testes API (gap atual)

Criar `tests/portal-read/escritorio-config-router.test.ts` (mínimo 4 casos):

- GET/PATCH config 200 admin
- PATCH operador → 403
- GET regua lista
- POST regua 409 duplicate (mock DB ou supertest com mocks como `escritorio-assinatura-router.test.ts`)

Opcional: `escritorio-regua-router.test.ts` se PR ficar grande — priorizar config + 1 regua.

### C.5 — Documentação

- `docs/API_CONTRATO_E_SMOKE.md` — tabela rotas escritório config/regua/templates/preview
- `docs/PORTAL_WEB.md` — `/configuracoes` descrito
- `RETOMADA_FABRICA.md` — Sprint C em progresso / concluído

---

## Critérios de aceite (DoD)

| # | Critério |
|---|----------|
| 1 | `/configuracoes` funcional para `admin_escritorio` (3 secções) |
| 2 | `npm run portal:build` + `portal:test` verdes |
| 3 | `npm test` verde; novos testes router config/regua |
| 4 | Contrato HTTP atualizado |
| 5 | PR < 600 linhas úteis **ou** dividir em PR C.1 (config) + PR C.2 (regua+templates) com acordo TL |
| 6 | Handoff Tech Lead no PR (governança §5) |

---

## Demo manual (Tech Lead / PO)

1. Login seed `admin_escritorio` → `/configuracoes`
2. PATCH gateway Asaas com api_key sandbox → GET mostra mascarado
3. Criar regra régua `days_offset: -1`, canal email
4. Editar template do tenant → preview com `charge_id` de cobrança existente

---

## SYSTEM PROMPT (colar no Cursor — fábrica)

```
Sprint C — cobranca-saas-api. Base: main (36f3a42+).

Ler: Projeto_CobrancaBoleto/DEMANDA_SPRINT_C_PORTAL_CONFIGURACOES.md
Branch: feat/sprint-c-portal-configuracoes

Entregar UI /configuracoes (config + regua + templates) consumindo API existente em escritorio-router.
Adicionar funções em apps/portal-web/src/lib/api.ts + testes portal + tests/portal-read/escritorio-config-router.test.ts.
Atualizar API_CONTRATO_E_SMOKE.md e PORTAL_WEB.md.

Não reimplementar backend use-cases. Não mergear — abrir PR e handoff Tech Lead (GOVERNANCA_FABRICA_COMMIT_PR.md).
```

---

*Próximo após merge Sprint C: Sprint D (idempotência inbox + evidências Asaas) — ver RETOMADA §4.4.*
