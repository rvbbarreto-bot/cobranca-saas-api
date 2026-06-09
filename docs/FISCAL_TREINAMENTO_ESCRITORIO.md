# Treinamento — Escritório: guias fiscais DAS (portal Exeq)

Material para **admin_escritorio** e **operador**. Captura real aguarda configuração do cliente (gateway Receita); homolog interno usa stub.

---

## 1. Papéis

| Papel | Pode fazer |
|-------|------------|
| **admin_escritorio** | Cadastrar certificado A1 e procuração; ver config fiscal; tudo do operador |
| **operador** | Listar guias, ver detalhe, acompanhar status |

---

## 2. Ativar módulo (DevOps)

```env
# API
FISCAL_GUIAS_ENABLED=true
FISCAL_CAPTURE_STUB=true

# Portal
VITE_FISCAL_GUIAS_ENABLED=true
```

Reiniciar API e rebuild/preview do portal.

---

## 3. Fluxo admin — antes da primeira captura

1. **Clientes** — cadastrar empresa com **CNPJ** (obrigatório para DAS).
2. **Config. fiscal** (`/configuracoes/fiscal`):
   - Aba **Certificado A1**: colar PEM do certificado e chave privada; informar validade.
   - Aba **Procuração**: CPF/CNPJ do procurador e validade e-CAC.
3. Confirmar **opt-in WhatsApp** no cadastro do cliente (para aviso `guia.disponivel`).

> O certificado é cifrado no servidor. Não enviar PEM por e-mail ou chat.

---

## 4. Fluxo operador — acompanhar guias

1. Menu **Guias fiscais (DAS/DARF)**.
2. Filtrar por competência ou abrir **Detalhe**.
3. Status esperados:
   - `PROCESSANDO` — captura em andamento
   - `DISPONIVEL` — guia pronta (compliance OK + PDF)
   - `PAGO` / `VENCIDO` — conforme operação futura

Operador **não** cadastra certificado.

---

## 5. Disparo de captura (n8n / automação)

Payload inbox (escritório dispara via n8n ou integração):

```json
{
  "event_type": "fiscal.capture.requested",
  "portal_cliente_id": "<uuid cliente>",
  "tipo_guia": "DAS",
  "competencia": "2026-06",
  "idempotency_key": "escritorio:<cliente>:2026-06:DAS"
}
```

Workflow DAS: `docs/n8n/workflows/fiscal-capture-stub-homolog.workflow.json`.

**DARF (Fase 2.5):**

```json
{
  "event_type": "fiscal.capture.requested",
  "portal_cliente_id": "<uuid cliente>",
  "tipo_guia": "DARF",
  "competencia": "2026-06",
  "codigo_receita": "0561",
  "periodo_apuracao": "2026-06-30",
  "idempotency_key": "escritorio:<cliente>:2026-06:DARF"
}
```

Workflow DARF: `docs/n8n/workflows/fiscal-capture-darf-stub-homolog.workflow.json`.

---

## 6. WhatsApp ao disponibilizar guia

Quando a guia fica `DISPONIVEL`, a API enfileira mensagem **guia.disponivel** (template migration 029).

Requisitos:

- Cliente com telefone e `opt_in_whatsapp = true`
- Z-API configurada em **Configurações → Gateway** (escritório)

---

## 7. FAQ

**Por que a guia ficou em PROCESSANDO?**  
Worker fiscal ou Redis parado; ou captura real sem certificado/procuração.

**DARF?**  
Disponível via workflow n8n `fiscal-capture-darf-stub-homolog.workflow.json` (stub ou mock gateway).

**Quando liga captura real?**  
Quando o cliente entregar URL gateway Receita + S3 + credenciais. Ver [FISCAL_HOMOLOG_E2E.md](./FISCAL_HOMOLOG_E2E.md).

---

## 8. Checklist treinamento (15 min)

- [ ] Login portal admin
- [ ] Abrir Config. fiscal e localizar abas
- [ ] Abrir Guias fiscais e interpretar status
- [ ] (Opcional) Executar workflow n8n stub e ver guia DISPONIVEL

---

*Versão alinhada Exeq — maio/2026. PO autorizou desenvolvimento paralelo sem config Receita do cliente.*
