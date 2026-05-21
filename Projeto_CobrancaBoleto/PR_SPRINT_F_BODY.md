## Summary

- Tela `/cobrancas/:chargeId/editar` para retificar valor e vencimento via `PATCH /v1/portal/cobrancas/:id`.
- Links **Editar** no detalhe e na lista (ocultos para `paga`/`cancelada`).
- `cobrancaEditFormSchema`, `isChargeEditable`, testes Vitest e `PORTAL_WEB.md`.

## Sprint / governança

- Sprint: **F** (P0 UX) — `DEMANDA_SPRINT_F_PORTAL_EDITAR_COBRANCA.md`
- IA: commit + PR — merge pelo **Tech Lead**

## Test plan

- [x] `npm run build`
- [x] `npm test` (203/203)
- [x] `npm run portal:test` (33/33)
- [ ] CI `quality:gate`

## Demo sugerida

1. Login portal → `/cobrancas` → boleto **emitido** → **Editar**.
2. Alterar vencimento → Salvar → detalhe atualizado.
3. Boleto **pago** → sem link Editar.

## Riscos / atenção

- Apenas front + docs; API PATCH já existente.
- Edição bloqueada no servidor para `paga`/`cancelada` (409).
