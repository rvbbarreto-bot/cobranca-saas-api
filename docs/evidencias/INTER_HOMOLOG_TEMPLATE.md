# Evidência — Homologação Banco Inter (API + Portal)

**Roteiro:** [QA_HOMOLOG_INTER_GATEWAY_PORTAL.md](../QA_HOMOLOG_INTER_GATEWAY_PORTAL.md) · **Setup:** [QA_INTER_SETUP_GUIA_PASSO_A_PASSO.md](../QA_INTER_SETUP_GUIA_PASSO_A_PASSO.md)  
**Collection Postman:** [../../postman/Inter_Gateway_Homolog.postman_collection.json](../../postman/Inter_Gateway_Homolog.postman_collection.json)  
**Executor:** _______________ **Data:** __________ **Ambiente:** local / homolog  

---

## 1. Metadados

| Campo | Valor |
|-------|--------|
| Branch / commit | |
| API `baseUrl` | http://localhost:3333 |
| Portal | http://localhost:5173 |
| `ENCRYPTION_KEY` rotacionada durante teste? | ☐ Sim ☐ Não |
| Redis / fila emissão ativos? | ☐ Sim ☐ Não |
| Credenciais Inter sandbox fornecidas por (PO): | |

---

## 2. Resultado por cenário (matriz INT)

| ID | Cenário | P | Resultado | Notas / bug # |
|----|---------|---|-----------|---------------|
| INT-01 | Listar providers inclui Inter | P0 | ☐ Pass ☐ Fail ☐ N/A | |
| INT-02 | Schema Inter — 4 campos obrigatórios | P0 | ☐ Pass ☐ Fail ☐ N/A | |
| INT-03 | PATCH gateway — credenciais cifradas | P0 | ☐ Pass ☐ Fail ☐ N/A | |
| INT-04 | Secrets não expostos (API/UI/logs) | P0 | ☐ Pass ☐ Fail ☐ N/A | |
| INT-05 | Emissão boleto → `emitida` | P0 | ☐ Pass ☐ Fail ☐ N/A | |
| INT-06 | `payment_transactions.gateway=inter` | P1 | ☐ Pass ☐ Fail ☐ N/A | |
| INT-07 | Troca gateway com log | P1 | ☐ Pass ☐ Fail ☐ N/A | |
| INT-08 | Regressão Asaas | P0 | ☐ Pass ☐ Fail ☐ N/A | |
| INT-09 | PIX com gateway Inter (negativo) | P2 | ☐ Pass ☐ Fail ☐ N/A | |

**Veredito PO:** ☐ Aprovado homolog Inter ☐ Reprovado — bloqueios: _______________

---

## 3. Parte A — API (Postman / curl)

### 3.1 Login portal

| Campo | Valor |
|-------|--------|
| HTTP status | |
| `access_token` obtido? | ☐ Sim |

```json
// Colar resposta mascarada (sem token completo — últimos 8 chars OK)
```

### 3.2 GET `/gateway/providers` — Inter presente?

```json

```

### 3.3 GET `/gateway/providers/inter/schema`

```json

```

### 3.4 PATCH `/gateway` — configurar Inter

| Campo | Valor |
|-------|--------|
| HTTP status | |
| `config.gateway_provider` | |
| `config.gateway_credentials_configured` | |

```json

```

### 3.5 GET `/config` (mascarado)

```json

```

---

## 4. Parte B — Portal (UI)

| Passo | Screenshot | Arquivo |
|-------|----------|---------|
| B1 Select Banco Inter | ☐ | `prints/INTER_B1_provider.png` |
| B4 Guardar sucesso | ☐ | `prints/INTER_B4_saved.png` |
| B8 Histórico troca gateway | ☐ | `prints/INTER_B8_history.png` |

**Observações UI:**

---

## 5. Parte C — Emissão boleto

**Roteiro PO:** [QA_TESTE_PO_EMISSAO_BOLETO_INTER.md](../QA_TESTE_PO_EMISSAO_BOLETO_INTER.md) (critérios AC-01…AC-10)

### 5.1 Dados da cobrança criada

| Campo | Valor |
|-------|--------|
| `charge_id` | |
| `reference` | |
| `idempotency_key` | |
| `amount` | |
| `due_date` | |
| `portal_cliente_id` | |

### 5.2 Timeline de status

| Momento | `canonical_status` | Observação |
|---------|-------------------|------------|
| T+0 criação | rascunho | |
| T+30s | | |
| T+2min | | |

### 5.3 GET cobrança (detalhe API)

```json

```

### 5.4 SQL / DB (opcional)

```sql
-- charges
```

```sql
-- payment_transactions
```

| `provider_charge_id` (Inter UUID) | |
| `boleto_barcode` / linha digitável | |
| `gateway` | |

---

## 6. Troca de gateway (INT-07)

| De | Para | `gateway_change_log` id | Data |
|----|------|-------------------------|------|
| | | | |

```json
// GET /gateway/history
```

---

## 7. Regressão Asaas (INT-08)

| Campo | Valor |
|-------|--------|
| Tenant / cenário | |
| Emissão OK? | ☐ Sim ☐ Não |

---

## 8. Cenários negativos

### INT-09 — Cobrança PIX com gateway Inter

| Esperado | Observado |
|----------|-----------|
| `erro_emissao` ou mensagem clara | |

### Credenciais inválidas (opcional)

| Ação | Resultado |
|------|-----------|
| PEM errado + nova emissão | |

---

## 9. Logs e erros (sem secrets)

```
Colar trechos relevantes: [payment-emission], GatewayAuthError, GatewayProviderError
```

| Correlation / charge_id | Mensagem resumida |
|-----------------------|-------------------|
| | |

---

## 10. Anexos

| Arquivo | Descrição |
|---------|-----------|
| Export Postman Collection Runner | |
| `prints/*.png` | Screenshots portal |
| Este ficheiro preenchido | `INTER_HOMOLOG_YYYYMMDD_iniciais.md` (cópia deste template) |

---

## 11. Assinaturas

| Papel | Nome | Data |
|-------|------|------|
| QA | | |
| PO | | |
| Tech Lead | | |

---

*Preencher após [QA_HOMOLOG_INTER_GATEWAY_PORTAL.md](../QA_HOMOLOG_INTER_GATEWAY_PORTAL.md). Nunca anexar PEM, `client_secret` ou `.env` completos.*
