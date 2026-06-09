# Homolog fiscal DAS + DARF — fluxo ponta a ponta

Validação **certificado → inbox → captura Receita (mock ou real) → PDF → WhatsApp** para **DAS e DARF** no ambiente de homologação.

---

## 1. Modos de gateway Receita

| Modo | `RECEITA_DAS_CAPTURE_URL` | Quando usar |
|------|---------------------------|-------------|
| **Mock local** | `http://127.0.0.1:19443` | Dev/homolog sem gateway Exeq deployado |
| **Homolog real** | `https://gateway-receita-homolog.exeq/...` | Integração com serviço Receita da fábrica |
| **Stub (Fase 1.1)** | *(não usar com captura real)* | `FISCAL_CAPTURE_STUB=true` — sem HTTP Receita |

---

## 2. Variáveis de ambiente (`.env`)

```env
FISCAL_GUIAS_ENABLED=true
FISCAL_CAPTURE_STUB=false
RECEITA_DAS_CAPTURE_URL=http://127.0.0.1:19443
# Gateway HTTPS homolog (mTLS):
# RECEITA_DAS_CAPTURE_URL=https://gateway-receita-homolog.exemplo/v1
# RECEITA_DAS_TLS_INSECURE=true   # apenas se certificado servidor nao confiavel (NAO prod)

ENCRYPTION_KEY=<64 hex chars>
REDIS_URL=redis://localhost:6379
FISCAL_PDF_STORAGE=local
FISCAL_PDF_LOCAL_DIR=./data/fiscal-homolog-e2e

# WhatsApp real (opcional no E2E automatizado — script usa mock Z-API)
ZAPI_INSTANCE=...
ZAPI_TOKEN=...
```

---

## 3. Homolog local (mock Receita)

**Terminal 1 — mock gateway:**

```bash
npm run receita:mock:gateway
```

Responde `POST /das/capture` e `POST /darf/capture` com PDF mínimo, linha digitável e `compliance_status: aprovado`.

**Terminal 2 — API + workers:**

```bash
npm run migrate
npm run seed:dev
npm run dev
```

**Terminal 3 — E2E automatizado:**

```bash
set RUN_FISCAL_HOMOLOG_E2E=1
set RECEITA_DAS_CAPTURE_URL=http://127.0.0.1:19443
npm run fiscal:homolog:e2e
```

Relatório JSON em `docs/evidencias/fiscal-homolog-e2e-*.json` (**15 assertions**: setup + DAS + DARF + evidência).

### 3.1 Fluxo DARF no E2E automatizado

O script `npm run fiscal:homolog:e2e` executa **dois** ciclos completos após cadastro certificado/procuração:

1. **DAS** — inbox `tipo_guia: DAS` → `POST /das/capture` no mock
2. **DARF** — inbox com `codigo_receita: "0561"`, `periodo_apuracao` → `POST /darf/capture`

Assertions prefixadas `das_*` e `darf_*` no JSON de evidência.

**n8n DARF (stub):** importar `docs/n8n/workflows/fiscal-capture-darf-stub-homolog.workflow.json` — ver [n8n/README.md](./n8n/README.md).

---

## 4. Homolog com gateway Receita real

1. Obter URL homolog da equipe de infra (`RECEITA_DAS_CAPTURE_URL`).
2. Certificado A1 válido da empresa de teste (CNPJ com procuração e-CAC).
3. Cadastrar via portal ou API:

```http
POST /v1/portal/fiscal/certificados
Authorization: Bearer …
x-tenant-id: <automacao.tenant_id>

{
  "portal_cliente_id": "<uuid>",
  "label": "A1 Homolog",
  "valid_from": "2026-01-01",
  "valid_until": "2027-12-31",
  "certificado_pem": "-----BEGIN CERTIFICATE-----…",
  "chave_privada_pem": "-----BEGIN PRIVATE KEY-----…"
}
```

```http
POST /v1/portal/fiscal/procuracoes
…
{
  "portal_cliente_id": "<uuid>",
  "tipo": "ecac",
  "procurador_documento": "12345678901",
  "validade_inicio": "2026-01-01",
  "validade_fim": "2027-12-31"
}
```

4. Disparar captura (n8n ou inbox direto):

```http
POST /v1/inbox/webhooks
x-tenant-id: demo
x-webhook-secret: …

{
  "event_type": "fiscal.capture.requested",
  "portal_cliente_id": "<uuid>",
  "tipo_guia": "DAS",
  "competencia": "2026-05",
  "idempotency_key": "escritorio:cliente:2026-05:DAS"
}
```

**DARF:**

```http
POST /v1/inbox/webhooks
…
{
  "event_type": "fiscal.capture.requested",
  "portal_cliente_id": "<uuid>",
  "tipo_guia": "DARF",
  "competencia": "2026-06",
  "codigo_receita": "0561",
  "periodo_apuracao": "2026-06-30",
  "idempotency_key": "escritorio:cliente:2026-06:DARF"
}
```

5. Confirmar worker `fiscal-capture` consumindo fila (logs `[fiscal-capture.worker]`).
6. Validar guia `DISPONIVEL` + `pdf_url` em `GET /v1/portal/fiscal/guias/:guiaId`.
7. WhatsApp: cliente com `opt_in_whatsapp=true` e template `guia.disponivel` (migration 029).

---

## 5. Checklist de aceite homolog

| # | Critério | Verificação |
|---|----------|-------------|
| 1 | Certificado cifrado no banco | `fiscal.certificado_digital` sem PEM em claro |
| 2 | Inbox idempotente | Reenvio mesmo `idempotency_key` não duplica guia |
| 3 | Captura Receita HTTP/mTLS | Audit `capture_requested` → `guia_disponibilizada` |
| 4 | PDF em storage | `pdf_storage_key` + `pdf_url` preenchidos |
| 5 | Compliance | Só `DISPONIVEL` com `compliance_status` aprovado/dispensado |
| 6 | WhatsApp enfileirado | Job `guia-disponivel-<guiaId>` na fila `notifications-send` |
| 7 | Cross-tenant | Testes integração `fiscal-certificados.integration.test.ts` verdes |

---

## 6. Troubleshooting

| Sintoma | Causa provável |
|---------|----------------|
| `receita_url_missing` | `RECEITA_DAS_CAPTURE_URL` ausente com stub off |
| `certificado_ausente` | POST certificado não feito ou `valid_until` expirado |
| `capture_failed` / TLS | Certificado servidor; tentar `RECEITA_DAS_TLS_INSECURE=true` só em homolog |
| Guia `PROCESSANDO` parada | Worker fiscal-capture não rodando ou Redis off |
| WhatsApp não enviado | `opt_in_whatsapp=false`, template ausente, ou Z-API não configurado |

---

## 7. Fora de escopo (backlog pos-Fase 2.1)

- Conciliação bancária guia fiscal (Fase 2.6)
- MFA transversal portal

**Mock gateway (DAS + DARF):** `npm run receita:mock:gateway` — `POST /das/capture` e `POST /darf/capture` em `http://127.0.0.1:19443`.

Contrato HTTP gateway: [ADR_FISCAL_GUIAS_FASE0.md](./ADR_FISCAL_GUIAS_FASE0.md) sec. 12 (DAS) e sec. 15 (DARF).
