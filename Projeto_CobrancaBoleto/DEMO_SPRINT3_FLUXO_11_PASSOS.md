# Demo Sprint 3 — Fluxo ponta a ponta (11 passos)

**Audiência:** PO, stakeholders, QA  
**Pré-requisitos:** API `http://localhost:3333`, `docker compose up -d`, migrations aplicadas, `PORTAL_CLIENT_URL` no `.env`, portal web em `http://localhost:5173`

**Automação (referência):** `npm run test:integration:sprint3` ou `npm run test:integration:sprint3:docker`  
**CI:** incluído em `npm run test:integration` após merge.

---

## Roteiro da demo (~25 min)

| # | Ação | Resultado esperado | Quem demonstra |
|---|------|-------------------|----------------|
| 1 | Escritório: `POST /v1/portal/cobrancas` type=`pix` | 201, `canonical_status=rascunho`, job enfileirado | API / Portal |
| 2 | Worker `payment-emission` (ou aguardar fila) | QR PIX gerado, status `emitida` | Logs worker / GET cobrança |
| 3 | `GET /v1/portal/cobrancas/:id` | `payment.pix_qrcode_base64` preenchido | Portal detalhe |
| 4 | Simular `POST /v1/inbox/webhooks` `PAYMENT_CONFIRMED` | `paga`, notificação `pagamento_confirmado`, régua cancelada | API / inbox |
| 5 | `GET /v1/portal/cobrancas/:id` | `canonical_status=paga` | Portal |
| 6 | Cliente: `POST /v1/portal/cliente/auth/request-access` | 200 genérico; e-mail com magic link (`communication_events` sent) | `/acesso` ou API |
| 7 | `POST /v1/portal/cliente/auth/verify-token` | JWT `cliente_cnpj` | Link do e-mail |
| 8 | `GET /v1/portal/cliente/cobrancas` | Lista inclui cobrança paga | Portal cliente |
| 9 | `GET /v1/portal/cliente/cobrancas/:id` | `events[]` com transição para `paga` | Portal cliente detalhe |
| 10 | `GET /v1/portal/escritorio/dashboard?periodo=30d` | `valor_total_recebido > 0`, `taxa_conversao` | Dashboard escritório |
| 11 | `GET /v1/portal/escritorio/cobrancas/export?format=csv` | CSV com headers corretos, documento mascarado | Download relatório |

---

## Checklist pré-demo (5 min)

- [ ] `GET /health/ready` → 200
- [ ] `bash Projeto_CobrancaBoleto/validacao_sprint3.sh` → 6/6
- [ ] Redis + workers ativos (`charges:emission`, `notifications:send`, `inbox:process`)
- [ ] Cliente de teste com e-mail válido (ou mock Resend em dev)
- [ ] Tenant slug conhecido (ex.: `escritorio-demo`)

---

## Pós-demo / encerramento Sprint 3

- [ ] PR mergeado em `main`
- [ ] CI verde (integração + E2E Sprint 3)
- [ ] Migration 021 em staging/prod
- [ ] `PORTAL_CLIENT_URL` apontando para front publicado

*Próximo milestone: Sprint 4 — SaaS Billing + n8n (ver `DEMANDA_SPRINT3_FRONT.md`).*
