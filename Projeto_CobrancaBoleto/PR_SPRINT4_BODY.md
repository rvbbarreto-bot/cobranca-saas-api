## Summary

Sprint 4 — **fase 1: SaaS Billing** (planos, assinaturas, metering, enforcement + portal).

- Migration `023`: `planos`, `assinaturas`, `tenant_usage_monthly` + seed
- Módulo `src/modules/saas-billing/`
- `GET /v1/saas/plans`, `GET /v1/portal/escritorio/assinatura`
- Provision com `plano_slug` + trial 14d; limites em POST cobrança/cliente
- Testes: integração Sprint 4 + router assinatura + unitários metering
- Portal: bloco **Plano e assinatura** em `/escritorio`
- Docs: `RETOMADA_FABRICA.md`, contrato API atualizado

## Checklist Sprint 4 fase 1

- [x] Migration 023
- [x] Módulo saas-billing
- [x] GET plans + GET assinatura
- [x] Provision + trial + enforcement
- [x] Testes integração + router (8+ casos novos)
- [x] UI `/escritorio`
- [x] `validacao_sprint4.sh` 6/6
- [x] `API_CONTRATO_E_SMOKE.md`
- [ ] CI `quality:gate` verde
- [ ] Aceite PO (demo limites)

## Test plan

```bash
npm ci && npm run migrate && npm run seed:dev
npm run build && npm test
npm run portal:test
bash Projeto_CobrancaBoleto/validacao_sprint4.sh
npm run quality:gate
```

## Fora de escopo (próximo PR)

- `GET /v1/saas/metrics` (MRR)
- Webhooks n8n + `docs/N8N_WEBHOOKS.md`
