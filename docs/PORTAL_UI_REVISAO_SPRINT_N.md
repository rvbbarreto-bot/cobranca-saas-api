# Revisão UI/UX — Sprint N (Onda A)

**Data início:** 2026-05-23 · **Branch:** `feat/sprint-n-entrega-produto`

## Telas visitadas / impactadas neste PR

| Tela | Status | Notas |
|------|--------|-------|
| Detalhe boleto (`BoletoDetalhePage`) | Corrigido | payment-panel, timeline, resumo |
| Edição boleto (`CobrancaEditPage`) | Corrigido | `BrDatePicker` alinhado à nova cobrança |
| Lista boletos (`CobrancasPage`) | Parcial | toolbar select com tokens |
| Dashboard | Parcial | cards quick links |
| Modais (`ConfirmDialog`) | OK | herda `modal-card` tokens |
| Nova cobrança | OK (P0 #25) | sem regressão |

## Componentes corrigidos

- `.payment-panel`, `.payment-panel--pending`, `.payment-panel__emv`, `.payment-panel__qr`
- `.boleto-summary__row`, `.timeline*`
- `.dash-card*`, `.cobrancas-toolbar__filter select`
- `BrDatePicker` em `CobrancaEditPage`
- `aria-label` em botões copiar PIX (`ChargePaymentPanel`)

## Critérios P0 UI (#25)

- [x] Tokens globais mantidos
- [x] Detalhe boleto legível tema claro/escuro (CSS tokens)
- [ ] Prints evidência QA (Onda 0 — humano)

## Melhorias futuras (fora deste PR)

- Login / Autenticação — hex legados no split layout
- Configurações — abas gateway revisão fina
- Relatórios filtros data (Onda C)
- Playwright snapshot tema claro/escuro
