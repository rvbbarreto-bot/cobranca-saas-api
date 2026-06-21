# Gateway mTLS — pacote completo na alteração (ADR GATEWAY-MTLS-FULL-BUNDLE)

**Data:** Jun/2026 · **Ambiente QA:** local Docker `:3333` + portal `:5173`

## Cenários QA

| # | Cenário | Resultado esperado |
|---|---------|-------------------|
| Q1 | Primeira gravação Inter: upload PEM + client_id + secret alinhados (OU = client_id) | PATCH 200 |
| Q2 | Upload exibe linha `Integracao Inter (OU do certificado): <uuid>` | Operador copia Client ID correto |
| Q3 | Editar Inter: só trocar Client ID sem re-upload | Portal bloqueia ou API 422 |
| Q4 | Editar Inter: re-upload PEM + client_id + secret da mesma integração | PATCH 200 |
| Q5 | Client ID ≠ OU do cert | 422 alinhamento Inter (mensagem existente) |

## Comandos

```powershell
npm run qa:inter-check-cert-ou -- "<pasta-cert-inter>" "<client_id>"
npm run test -- tests/platform/mtls-full-bundle-policy.test.ts
```

## Doc

[ADR_GATEWAY_MTLS_FULL_BUNDLE.md](../../ADR_GATEWAY_MTLS_FULL_BUNDLE.md)
