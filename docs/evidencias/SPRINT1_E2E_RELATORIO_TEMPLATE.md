# Relatório de evidência — E2E Asaas Sandbox (Sprint 1)

## 1. Metadados

| Campo | Valor |
|-------|--------|
| Data/hora (UTC) | |
| Branch | |
| Commit hash | |
| Ambiente | local / homolog |
| Executor | |

## 2. Variáveis de ambiente (mascaradas)

| Variável | Presente | Valor (mascarado) |
|----------|----------|-------------------|
| `DATABASE_URL` | ☐ | `postgres://***@host/db` |
| `ASAAS_API_KEY` | ☐ | `$aact_***` |
| `ASAAS_API_URL` | ☐ | `https://sandbox.asaas.com/api/v3` |
| `ENCRYPTION_KEY` | ☐ | `***` (64 hex) |
| `WEBHOOK_INBOX_SECRET` | ☐ | `***` |

## 3. Payload criação cobrança interna

```json

```

## 4. Response API interna (201)

```json

```

## 5. Retorno Asaas Sandbox (mascarado)

```json

```

## 6. Registro DB — `charges`

```json

```

## 7. Registro DB — `payment_transactions` / `payment_id` externo

```json

```

## 8. Webhook recebido (`webhook_inbox`)

```json

```

## 9. `charge_events` (transições)

```json

```

## 10. Idempotência — reenvio webhook

| Tentativa | HTTP | `deduplicated` | Novos `charge_events` |
|-----------|------|----------------|------------------------|
| 1 | | | |
| 2 | | | |

## 11. Consulta final cobrança

- `GET /v1/portal/cobrancas/:id` ou SQL: status final = _______

## 12. Painel (opcional)

Screenshots: `docs/evidencias/prints/`

## 13. Logs correlation

```
x-correlation-id: ...
```

## 14. Testes automatizados

```text
npm test → 
npm run test:integration → 
npm run e2e:asaas:evidence → 
```

## 15. Ausência de segredos no repo

```bash
git grep -i "aact_" -- ':!*.md' ':!*.example'
# resultado esperado: vazio
```

## Resultado

- [ ] **Aprovado** — todos os critérios PO atendidos  
- [ ] **Reprovado** — pendências: _______________
