# Roteiro de homologação — Banco Inter (API + Portal)

**Papel:** PO · QA · Tech Lead (credenciais)  
**Versão:** Maio 2026 · **Base:** Sprint L (#21) + portal dinâmico Sprint M  
**Referências:** [QA_INTER_SETUP_GUIA_PASSO_A_PASSO.md](./QA_INTER_SETUP_GUIA_PASSO_A_PASSO.md) (setup detalhado UI + Inter) · [ESTUDO_APIS_BANCARIAS.md](../Projeto_CobrancaBoleto/ESTUDO_APIS_BANCARIAS.md) §2 · [GATEWAY_UNIVERSAL.md](./GATEWAY_UNIVERSAL.md) · [QA_GUIA_TESTES_BDD.md](./QA_GUIA_TESTES_BDD.md)

---

## 1. Objetivo

Validar que um escritório consegue:

1. **Configurar** o gateway **Banco Inter** (credenciais sandbox cifradas).
2. **Emitir** cobrança `rascunho` → `emitida` via worker, com dados do Inter (código de solicitação, linha digitável/código de barras quando o sandbox devolver).
3. **Homologar o portal** em `/configuracoes` (select Inter, campos PEM, histórico de troca de gateway).
4. **Não regressar** tenant Asaas existente.

---

## 2. Responsabilidades

| Papel | Entrega |
|-------|---------|
| **PO / Financeiro** | Conta no [Portal Developers Inter](https://developers.inter.co/), certificado sandbox (.crt/.key ou PEM), `client_id` e `client_secret`, escopo **boleto-cobranca** |
| **Tech Lead** | `ENCRYPTION_KEY` estável no `.env` da API; Redis opcional (cache OAuth); filas BullMQ ativas se testar emissão assíncrona |
| **QA** | Executar roteiro abaixo, registar evidências, abrir bugs com request/response **sem** secrets |

---

## 3. Pré-requisitos de ambiente

### 3.1 Serviços locais

```bash
# Na raiz do repositório
npm ci
cp .env.example .env   # preencher conforme secção 3.2
npm run migrate
npm run seed:dev
npm run dev            # API :3333
npm run portal:dev     # Portal :5173
```

| Serviço | URL | Verificação |
|---------|-----|-------------|
| API health | http://localhost:3333/health | `status: ok` |
| API ready | http://localhost:3333/health/ready | Postgres OK |
| Portal login | http://localhost:5173/login | Formulário visível |

**Docker (opcional):** Postgres em `localhost:5434` — ver [LOCAL_DOCKER_SETUP.md](./LOCAL_DOCKER_SETUP.md).

### 3.2 Variáveis `.env` (API)

| Variável | Obrigatório | Nota |
|----------|-------------|------|
| `DATABASE_URL` | Sim | Ex.: `postgres://...@localhost:5434/cobranca_saas` |
| `ENCRYPTION_KEY` | Sim | 64 hex (`openssl rand -hex 32`) — **mesma chave** durante todo o teste |
| `JWT_SECRET` | Sim | ≥ 32 caracteres |
| `REDIS_URL` | Recomendado | Cache token Inter + fila `charges-emission` |
| `GATEWAY_INTER_ENABLED` | Não | Default `true`; `false` desliga Inter no registry |

**Não commitar** PEM, `client_secret` nem `.env` com credenciais reais.

### 3.3 Credenciais Inter (PO fornece ao QA — canal seguro)

Pacote mínimo para sandbox:

| Campo | Onde obter | Gravação no sistema |
|-------|------------|---------------------|
| `client_id` | Portal Inter → aplicação | JSON em `gateway_credentials` |
| `client_secret` | Portal Inter | idem |
| `certificate_pem` | Certificado emitido pelo Inter (conteúdo PEM) | idem |
| `private_key_pem` | Chave privada do certificado | idem |

**URLs Inter (sandbox):** token `https://cdpj-sandbox.partners.uatinter.co/oauth/v2/token` · API `https://cdpj-sandbox.partners.uatinter.co` — ver ESTUDO §2.

### 3.4 Login portal (seed dev)

| Campo | Valor |
|-------|--------|
| E-mail | `portal-seed@local.dev` |
| Tenant (slug) | `escritorio-demo` |
| Senha | `PortalSeedDev!ChangeMe1` (ou `SEED_PORTAL_PASSWORD` no `.env`) |
| Papel | `admin_escritorio` (obrigatório para `/configuracoes`) |

---

## 4. Matriz de cenários (resumo PO)

| ID | Cenário | Prioridade | Aceite |
|----|---------|------------|--------|
| INT-01 | Listar providers inclui Inter | P0 | API e portal mostram "Banco Inter" |
| INT-02 | Schema Inter exige 4 campos | P0 | `client_id`, `client_secret`, `certificate_pem`, `private_key_pem` |
| INT-03 | Salvar credenciais Inter cifradas | P0 | PATCH retorna 200; `gateway_credentials_configured: true` |
| INT-04 | Credenciais não aparecem em claro | P0 | UI só placeholders; logs/audit sem PEM |
| INT-05 | Emissão boleto rascunho → emitida | P0 | `canonical_status=emitida`, `provider_charge_id` preenchido |
| INT-06 | `payment_transactions` com gateway `inter` | P1 | Linha com `gateway_transaction_id` = UUID Inter |
| INT-07 | Troca Asaas → Inter com log | P1 | Linha em `gateway_change_log` + lista no portal |
| INT-08 | Regressão Asaas | P0 | Tenant de teste Asaas continua emitindo |
| INT-09 | PIX dedicado Inter | P2 | Cobrança tipo `pix` → `erro_emissao` ou mensagem clara (PIX API Inter desabilitada para novas integrações) |

---

## 5. Parte A — Configurar API Inter (sem portal)

Útil para isolar credenciais antes da UI.

### 5.1 Obter token JWT do portal

```http
POST http://localhost:3333/v1/portal/auth/login
Content-Type: application/json

{
  "email": "portal-seed@local.dev",
  "tenant_id": "escritorio-demo",
  "password": "PortalSeedDev!ChangeMe1"
}
```

Guardar `access_token`.

### 5.2 Listar gateways disponíveis

```http
GET http://localhost:3333/v1/portal/escritorio/gateway/providers
Authorization: Bearer <access_token>
```

**Esperado:** item `id: "inter"`, `enabled: true`, `authType: "mtls_oauth"`.

### 5.3 Schema do Inter

```http
GET http://localhost:3333/v1/portal/escritorio/gateway/providers/inter/schema
Authorization: Bearer <access_token>
```

**Esperado:** `credentialFields` com os 4 campos obrigatórios.

### 5.4 Configurar gateway (recomendado: rota dedicada)

```http
PATCH http://localhost:3333/v1/portal/escritorio/gateway
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "gateway_provider": "inter",
  "gateway_credentials": {
    "client_id": "<SANDBOX_CLIENT_ID>",
    "client_secret": "<SANDBOX_CLIENT_SECRET>",
    "certificate_pem": "-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----",
    "private_key_pem": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
  }
}
```

**Esperado:** `200`, `config.gateway_provider` = `"inter"`, `gateway_credentials_configured` = `true`.

**Alternativa legada:** `PATCH /v1/portal/escritorio/config` com o mesmo corpo + campos opcionais (`razao_social`, etc.).

### 5.5 Verificar config (mascarada)

```http
GET http://localhost:3333/v1/portal/escritorio/config
Authorization: Bearer <access_token>
```

**Esperado:** `gateway_provider: "inter"`, API key mascarada ou ausente; **nunca** PEM/secret em claro.

### 5.6 (Opcional) Teste direto no Inter

Fora do nosso sistema — Postman/curl no sandbox Inter com mTLS:

1. `POST /oauth/v2/token` com certificado no TLS + `client_credentials`.
2. `POST /cobrancas/v2` com Bearer.

Se falhar aqui, corrigir credenciais **antes** de abrir bug na API.

---

## 6. Parte B — Homologação no portal (QA UI)

### 6.1 Acesso

1. Abrir http://localhost:5173/login  
2. Login com credenciais seed (secção 3.4).  
3. Ir a **Configurações** → aba **Gateway e integrações**.

**Esperado:** utilizador `admin_escritorio`; operador/viewer **não** deve editar (403).

### 6.2 Configurar Inter pela UI

| Passo | Ação | Esperado |
|-------|------|----------|
| B1 | Select **Gateway** → **Banco Inter** | Campos dinâmicos aparecem (4 campos + textareas PEM) |
| B2 | Preencher Client ID e Client Secret | Inputs tipo password/text |
| B3 | Colar certificado e chave privada nos textareas PEM | Sem limite visual quebrado |
| B4 | Clicar **Guardar configurações** | Banner verde "Configurações guardadas." |
| B5 | Recarregar página (F5) | Provider continua **inter**; mensagem "Credenciais já configuradas" |
| B6 | Deixar PEM em branco e guardar de novo | Mantém credenciais anteriores (não apaga) |

**Evidência:** screenshot da aba Gateway com Inter selecionado (sem colar secrets na imagem — blur manual).

### 6.3 Troca de gateway (PO: permitir com log)

| Passo | Ação | Esperado |
|-------|------|----------|
| B7 | Com cobranças já **emitidas** no tenant, trocar gateway Asaas → Inter (ou Inter → Cora) | **Permitido**; sem erro de bloqueio |
| B8 | Secção **Últimas trocas de gateway** | Lista `asaas → inter` com data |

**Nota:** cobranças antigas permanecem no gateway em que foram emitidas; só **novas** emissões usam o provider atual.

### 6.4 Regressão visual

| Passo | Verificação |
|-------|-------------|
| B9 | Abas **Régua** e **Templates** ainda abrem |
| B10 | Menu **Cobranças**, **Clientes**, **Dashboard** funcionam após salvar gateway |

---

## 7. Parte C — Emissão ponta a ponta (boleto)

**Caso de teste PO (aceite formal):** [QA_TESTE_PO_EMISSAO_BOLETO_INTER.md](./QA_TESTE_PO_EMISSAO_BOLETO_INTER.md)

### 7.1 Pré-condição

- Gateway = `inter`, credenciais salvas (Parte A ou B).
- Worker de emissão ativo: API com Redis + processo que consome fila `charges-emission` (em dev, `npm run dev` costuma subir workers — confirmar logs `[payment-emission]`).

### 7.2 Fluxo portal

| Passo | Ação | Esperado |
|-------|------|----------|
| C1 | **Clientes** → cliente com CPF/CNPJ e e-mail válidos | Detalhe do cliente abre |
| C2 | **Nova cobrança** — tipo **boleto**, valor e vencimento futuro | Cobrança criada em `rascunho` |
| C3 | Aguardar 5–30 s (fila + Inter pode retornar `EM_PROCESSAMENTO`) | Status → **emitida** (ou **erro_emissao**) |
| C4 | Abrir detalhe da cobrança | Exibe barcode/linha digitável se Inter devolveu; URL boleto pode ser placeholder `inter://...` (limitação conhecida) |

### 7.3 Verificação técnica (QA com acesso DB ou API)

```sql
-- Ajustar tenant_id público do seed (ex.: via portal.billing_tenant_link)
SELECT gateway_provider FROM escritorio_config WHERE tenant_id = '<public_tenant_id>';

SELECT canonical_status, provider, provider_charge_id
FROM charges
ORDER BY created_at DESC
LIMIT 5;

SELECT gateway, gateway_transaction_id, boleto_barcode
FROM payment_transactions
ORDER BY created_at DESC
LIMIT 5;
```

**Esperado:** `provider` / `gateway` = `inter`; `provider_charge_id` = UUID (`codigoSolicitacao`).

### 7.4 Cenários negativos

| ID | Ação | Esperado |
|----|------|----------|
| C-N1 | Credenciais PEM inválidas + nova emissão | `erro_emissao`; evento `erro_emissao` na cobrança |
| C-N2 | `GATEWAY_INTER_ENABLED=false` + select Inter | Provider ausente na lista ou erro ao salvar |
| C-N3 | Cobrança **pix** com gateway Inter | Erro claro (PIX dedicado não suportado no adapter) |

---

## 8. Regressão Asaas (obrigatório)

Em tenant separado ou revertendo gateway para `asaas` com API key sandbox:

| Passo | Esperado |
|-------|----------|
| R1 | `gateway_provider=asaas` + `gateway_api_key` ou `{ "api_key": "..." }` |
| R2 | Nova cobrança boleto → `emitida` |
| R3 | Sem alteração em `ENCRYPTION_KEY` entre testes Asaas e Inter no **mesmo** `.env` |

---

## 9. Evidências para o PO (pacote de aceite)

**Template:** [evidencias/INTER_HOMOLOG_TEMPLATE.md](./evidencias/INTER_HOMOLOG_TEMPLATE.md)  
**Postman:** [postman/Inter_Gateway_Homolog.postman_collection.json](../postman/Inter_Gateway_Homolog.postman_collection.json) + [environment](../postman/Inter_Gateway_Homolog.postman_environment.json) — ver [postman/README_INTER_HOMOLOG.md](../postman/README_INTER_HOMOLOG.md)

| # | Evidência | Formato |
|---|-----------|---------|
| 1 | Screenshot portal — Inter selecionado + campos (secrets borrados) | PNG |
| 2 | Resposta `GET /config` (JSON mascarado) | JSON |
| 3 | Cobrança **emitida** no portal (lista + detalhe) | PNG |
| 4 | Query ou print `payment_transactions` com `gateway=inter` | SQL/PNG |
| 5 | Histórico troca gateway (se aplicável) | PNG |
| 6 | Log API sem PEM/secret (trecho `[payment-emission]` ou erro sanitizado) | TXT |

Gravar em `docs/evidencias/` com nome `INTER_HOMOLOG_YYYYMMDD_<iniciais>.md` (tabela passou/falhou).

---

## 10. Limitações conhecidas (não bloquear homologação P0 se emissão OK)

| Item | Comportamento atual | Sprint futura |
|------|-------------------|---------------|
| URL/PDF do boleto | Placeholder `inter://cobranca/{uuid}/pdf` | Buscar PDF via `GET .../pdf` Inter |
| Endereço do pagador | Default se cliente sem endereço no portal | Passar endereço do `portal.cliente` |
| Webhook pagamento Inter | Não normalizado no inbox | Sprint N |
| Smoke script | `RUN_INTER_SANDBOX=1` só imprime instrução | Script E2E com tenant + emissão |
| PIX API Inter | Não disponível para novas integrações (Inter) | Usar boleto |

---

## 11. Checklist final (PO assina)

- [ ] INT-01 a INT-05 passaram em sandbox  
- [ ] INT-07 troca com log validada  
- [ ] INT-08 regressão Asaas OK  
- [ ] Evidências arquivadas em `docs/evidencias/`  
- [ ] Bugs abertos com severidade (P0 bloqueia release)  

**Assinatura PO:** _______________ **Data:** __________  
**Assinatura QA:** _______________ **Data:** __________  

---

## 12. Referência rápida de endpoints

| Método | Caminho |
|--------|---------|
| GET | `/v1/portal/escritorio/gateway/providers` |
| GET | `/v1/portal/escritorio/gateway/providers/inter/schema` |
| PATCH | `/v1/portal/escritorio/gateway` |
| PATCH | `/v1/portal/escritorio/config` (legado) |
| GET | `/v1/portal/escritorio/gateway/history` |
| POST | `/v1/portal/cobrancas` (cria rascunho → fila emissão) |

---

*Documento para homologação manual. Dúvidas de payload HTTP → ESTUDO §2; arquitetura → GATEWAY_UNIVERSAL.md.*
