# Pacote de demandas — Sprint E: Orquestração n8n (P3)

**Emitido por:** Tech Lead · **Para:** Fábrica (IA + dev)  
**Data:** Maio 2026 · **Base:** `main` @ `1f4c328` (após PR #9 Sprint D)  
**Prioridade:** P3 · **Estimativa:** 5–7 dias · **Branch sugerida:** `feat/sprint-e-n8n-orquestracao`

---

## Gate de entrada

```bash
git fetch origin && git checkout main && git pull origin main
git checkout -b feat/sprint-e-n8n-orquestracao
npm ci && npm run migrate && npm run seed:dev
npm run build && npm test && npm run portal:test
npm run quality:gate    # com DATABASE_URL no .env
```

**Governança:** [GOVERNANCA_FABRICA_COMMIT_PR.md](./GOVERNANCA_FABRICA_COMMIT_PR.md) — IA faz commit + PR + handoff; **Tech Lead** faz merge.

**Pré-requisitos concluídos:** Sprint D (inbox idempotência), Sprint C (`/configuracoes`), régua + templates na API e no portal.

---

## Contexto

- **Outbound** já existe: `emitN8nPlatformEvent` em `src/platform/integrations/n8n-outbound.ts` — eventos `charge.paid`, `subscription.past_due`.
- **Inbound** já existe: `POST /v1/inbox/webhooks` com dedup — ver [INBOX_WEBHOOK_IDEMPOTENCIA.md](../docs/INBOX_WEBHOOK_IDEMPOTENCIA.md).
- **Régua interna** já roda via BullMQ (`daily-regua` 07h, `processDailyChargingRegua`, `notification-send`).

**Objetivo Sprint E:** fechar **P3** — contrato outbound alinhado ao ciclo de cobrança/régua, emissões nos pontos certos do código, documentação de workflow n8n e testes — **sem** substituir o pipeline Resend/Z-API (n8n é orquestração **paralela**).

**Fora de escopo:** NFS-e, `/internal/fiscal`, UI nova no portal, workflows n8n commitados com secrets, merge pela IA.

---

## Entregas (checklist)

### E.1 — Novos eventos outbound

Estender `N8nPlatformEventType` e documentar em [N8N_WEBHOOKS.md](../docs/N8N_WEBHOOKS.md):

| Evento | Quando emitir | Payload mínimo |
|--------|---------------|----------------|
| `charge.overdue` | `applyWebhookSideEffectPlan` → `payment_overdue` (após enfileirar régua 3d/7d) | `{ charge_id, tenant_id }` |
| `charge.cancelled` | `payment_cancelled` (após cancelar jobs régua) | `{ charge_id, tenant_id }` |
| `notification.regua_enqueued` | Cada `enqueueReguaNotificationJob` bem-sucedido (webhook overdue **e** `daily-regua`) | `{ charge_id, tenant_id, event_type, days_offset, channel? }` |

**Regras:**

- Manter fire-and-forget; falha n8n **não** quebra cobrança nem notificação interna.
- No-op se `N8N_PLATFORM_WEBHOOK_URL` vazio (comportamento atual).
- `occurred_at` ISO; `tenant_id` = UUID público do tenant.

**Opcional (se couber no PR < 400 linhas):** `charge.emitted` após emissão gateway OK — só se hook já existir sem refactor grande.

### E.2 — Implementação nos pontos de código

| Arquivo | Ação |
|---------|------|
| `n8n-outbound.ts` | Tipos + export estável |
| `webhook-side-effects.ts` | `emit` em `payment_overdue` e `payment_cancelled` |
| `enqueue-notification.ts` ou wrapper único | `emit` em `notification.regua_enqueued` (evitar duplicar em 3 sítios) |
| `charge-status-sync.worker.ts` | Sem lógica duplicada — usar o mesmo wrapper de enqueue |

### E.3 — Documentação operacional

1. Atualizar [N8N_WEBHOOKS.md](../docs/N8N_WEBHOOKS.md) — tabela completa de eventos + exemplo Switch no n8n.
2. Criar [docs/N8N_REGUA_WORKFLOW_EXEMPLO.md](../docs/N8N_REGUA_WORKFLOW_EXEMPLO.md):
   - Fluxo: `charge.paid` → CRM; `charge.overdue` → tarefa cobrança; `notification.regua_enqueued` → log/métrica.
   - Inbound: n8n chama `POST /v1/inbox/webhooks` com `X-External-Event-Id` estável (link com Sprint D).
3. Atualizar [DEPLOY_CHECKLIST.md](../docs/DEPLOY_CHECKLIST.md) — `N8N_PLATFORM_WEBHOOK_URL` / `SECRET` em staging/prod.

### E.4 — Testes

| Teste | Escopo |
|-------|--------|
| `tests/platform/integrations/n8n-outbound.test.ts` | Novos `event` types; garantir body JSON |
| `tests/platform/jobs/webhook-side-effects.test.ts` (novo ou extensão) | Mock `emitN8nPlatformEvent` em `payment_overdue` / `payment_cancelled` |
| Unitário enqueue | Mock emit ao enfileirar régua (1 caso) |

**Não obrigatório:** E2E com n8n real; usar `fetch` mock como hoje.

### E.5 — PR + handoff

- Título sugerido: `feat(n8n): eventos régua e ciclo cobrança (Sprint E)`
- Corpo: Summary + Test plan + referência a este arquivo
- Handoff §5 [GOVERNANCA_FABRICA_COMMIT_PR.md](./GOVERNANCA_FABRICA_COMMIT_PR.md)

---

## Definition of Done

```bash
npm run build
npm test                    # meta: 194+ (cresce com novos testes)
npm run portal:test         # 29/29 (sem mudança esperada no SPA)
npm run quality:gate        # CI
```

- [ ] Contrato [N8N_WEBHOOKS.md](../docs/N8N_WEBHOOKS.md) atualizado
- [ ] Nenhum secret no repositório
- [ ] PO/TL consegue descrever fluxo bidirecional API ↔ n8n em 5 min (doc + curl inbox)

---

## Perguntas para o PO (bloquear se ausente)

1. URL de staging n8n (`N8N_PLATFORM_WEBHOOK_URL`) — já existe ou usar noop até homolog?
2. n8n deve **substituir** envio e-mail/WhatsApp interno em algum canal? (**default:** não — só orquestração externa)
3. Prioridade de `charge.emitted` neste sprint ou PR seguinte?

---

## Referências

- [docs/FASE2_KICKOFF_QUALIDADE.md](../docs/FASE2_KICKOFF_QUALIDADE.md) — P3
- [docs/INBOX_WEBHOOK_IDEMPOTENCIA.md](../docs/INBOX_WEBHOOK_IDEMPOTENCIA.md)
- `src/platform/jobs/application/webhook-side-effects.ts`
- `src/platform/jobs/application/charge-status-sync-processor.ts`
