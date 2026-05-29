# Auditoria DoD — Sprint N Ondas B e D

**Tech Lead:** Fábrica · **Data:** 2026-05-28  
**Base auditada:** `main` @ `16cf460` (pós #28 Sprint K, #29 docs)  
**Entrega original B/D:** PR **#27** (`feat/sprint-n: PDF Inter via proxy portal e webhook Inter`)

---

## Resumo

| Onda | DoD | Resultado auditoria | Ação |
|------|-----|---------------------|------|
| **B** | N.2.1 Adapter PDF + mock | ✅ Atendido (#27) | — |
| **B** | N.2.2 Portal PDF + erro amigável | ✅ Corrigido | PR `fix/sprint-n-b-d-gaps` |
| **B** | N.2.3 Testes + GATEWAY_UNIVERSAL | ✅ Corrigido | + stream/fixtures/portal tests |
| **D** | N.4.1 Webhook + fixtures | ✅ Corrigido | + `inter-webhook-vencido.json` |
| **D** | N.4.2 charge-sync | ✅ Factory genérico | — |
| **D** | N.4.4 Testes integração | ✅ Com `DATABASE_URL` | — |

---

## Onda B — checklist

| ID | Critério | Evidência em `main` | Status |
|----|----------|---------------------|--------|
| N.2.1a | `InterAdapter.downloadBoletoPdf` | `inter-adapter.ts` | ✅ |
| N.2.1b | Placeholder `inter://cobranca/{codigo}/pdf` | `inter-pdf-url.ts` | ✅ |
| N.2.1c | Mock HTTP em testes | `inter-adapter.test.ts` | ✅ |
| N.2.2a | Proxy `GET /v1/portal/cobrancas/:id/boleto.pdf` | `portal-router.ts` | ✅ |
| N.2.2b | Botão “PDF do boleto” no detalhe | `ChargePaymentPanel.tsx` | ✅ |
| N.2.2c | Erro amigável se PDF falhar | Ausente no front | ⚠️ → gap PR |
| N.2.3a | `npm test` módulo Inter | `inter-*.test.ts` | ✅ |
| N.2.3b | `portal:test` | Parcial | ⚠️ → + `ChargePaymentPanel.test.tsx` |
| N.2.3c | `docs/GATEWAY_UNIVERSAL.md` | Seções PDF/Webhook | ✅ |

---

## Onda D — checklist

| ID | Critério | Evidência em `main` | Status |
|----|----------|---------------------|--------|
| N.4.1a | `POST /v1/webhooks` + `source: inter` | `inbox-router.ts` | ✅ |
| N.4.1b | `parse-inter-webhook.ts` | Mapeamento `situacao` | ✅ |
| N.4.1c | Fixtures `inter-webhook-*.json` | Só `pago` | ⚠️ → + `vencido` |
| N.4.1d | `charge_events` via inbox | `process-webhook-inbox` | ✅ |
| N.4.2 | charge-sync com factory | `charge-sync-reconciliation.ts` | ✅ |
| N.4.4 | Testes sem secrets | `parse-inter-webhook.test.ts`, `inter-webhook-payment.integration.test.ts` | ✅ |

---

## PR de correção (gaps)

**Branch:** `fix/sprint-n-b-d-gaps`  
**Escopo:** apenas itens ⚠️ acima — sem reimplementar #27.

---

*Referência demanda:* [DEMANDA_SPRINT_N_FASE2_ONDAS_B_D.md](./DEMANDA_SPRINT_N_FASE2_ONDAS_B_D.md)
