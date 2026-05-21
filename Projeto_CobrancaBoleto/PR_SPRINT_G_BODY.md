## Summary

- Emite evento n8n **`charge.emitted`** após `processPaymentEmission` concluir emissão gateway com sucesso.
- Documenta contrato em `docs/N8N_WEBHOOKS.md`.
- **Testes unitários:** `payment-emission-n8n.test.ts`, extensão `n8n-outbound.test.ts`.
- **Testes funcionais:** bateria **B6b** — `PATCH /v1/portal/cobrancas/:id` em cobrança `paga` retorna `409 charge_not_editable`.

## Test plan

- [ ] `npm run build`
- [ ] `npm test`
- [ ] `npm run portal:test`
- [ ] `npm run quality:gate` (com `DATABASE_URL` / Postgres)
- [ ] Opcional: `npm run test:integration` — validar B6 + B6b na bateria funcional

## Handoff Tech Lead

- Revisar que `charge.emitted` não dispara em falha de emissão nem `charge_not_found`.
- Merge em `main` quando CI verde.
- Próximo pacote: Sprint H (homolog Asaas) — ver `RETOMADA_FABRICA.md`.
