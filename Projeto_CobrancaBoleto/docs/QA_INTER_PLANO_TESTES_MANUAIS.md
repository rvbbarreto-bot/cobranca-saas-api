# Plano de Testes Manuais — Banco Inter (Sprint L Homologação)

**Papel:** QA  
**Emitido por:** PO — Ricardo  
**Data:** Maio 2026  
**Escopo:** Gateway Banco Inter — emissão de boleto via API própria + validação contra sandbox Inter  
**Base de código:** `main` (pós PR Sprint L — Inter + Cora implementados)  
**Smoke status:** ✅ 24/24 assertions passaram (pasta 0–2) — validado pela fábrica  
**Pendência:** Pasta 3 (emissão real) bloqueada por PEM — **prioridade deste guia**

---

## 1. Contexto — O que foi entregue na Sprint L

O objetivo da Sprint L foi permitir que um tenant configure **Banco Inter** ou **Cora** no portal e emita boletos usando o adapter correto, sem quebrar o Asaas. O que foi implementado:

| Componente | O que faz |
|---|---|
| `InterAdapter` | Adapter que implementa `PaymentGatewayAdapter`; usa mTLS + OAuth2 para chamar a API Inter |
| `GATEWAY_REGISTRY` | Registry central com configurações de Inter, Cora, Asaas (BB e C6 stub) |
| `getGatewayForTenant()` | Factory: lê `escritorio_config.gateway_provider` + `gateway_credentials_encrypted`, instancia o adapter correto |
| `buildMtlsAgent()` | Cria agent undici com cert+key PEM para chamadas mTLS |
| Token cache Redis | TTL 3600s com margem de −60s; não chama `/oauth/v2/token` a cada emissão |
| Migrations 025+026 | Coluna `gateway_credentials_encrypted` + CHECK atualizado para `inter`, `cora`, `asaas` |
| Portal API | `GET /api/gateway/providers` + `PATCH /api/escritorio/gateway/credentials` |

**Fora de escopo Sprint L (não testar agora):** BB, C6 Bank, estorno, webhook normalizado.

---

## 2. Acessos Necessários

> Verifique **todos** os acessos abaixo antes de iniciar. Qualquer item faltando bloqueia os testes.

### 2.1 Portal Inter Developers — Certificados PEM

**O que é:** Par de arquivos (cert + chave privada) para autenticação mTLS. Sem eles, nenhuma chamada à API Inter funciona.

**Como obter:**
1. Acesse [https://developers.inter.co](https://developers.inter.co) e faça login
2. Vá em **Meus Aplicativos → [nome do app sandbox]**
3. Clique em **Certificados** → seção Sandbox
4. Baixe `Inter_API_Certificado.crt` e `Inter_API_Chave.key`
5. Se já expirados ou perdidos: **Gerar novo certificado** (invalida o anterior)
6. Converta para PEM se necessário — veja seção 3.2

**Quem tem acesso:** A conta Inter do projeto é de propriedade do time Exeq. Se não tiver login, solicitar ao PO.

**Segurança:** Os arquivos PEM **nunca** vão para o Git. Guardá-los apenas no computador local e/ou 1Password do time.

### 2.2 Client ID e Client Secret

**O que é:** Credenciais OAuth2 do app sandbox Inter.

**Como obter:** Mesmo portal acima → **Meus Aplicativos → Credenciais**

**Onde configurar:**
- Postman: ambiente local → campo `inter_client_id` e `inter_client_secret` (coluna **Current Value** — nunca Initial Value)
- API local: endpoint `PATCH /api/escritorio/gateway/credentials` (ver cenário INT-07)

> ⚠️ O client secret foi colado no chat em sessão anterior. **Rotacione no portal Inter** antes de usar e repasse ao QA por canal seguro (1Password). Não commitar.

### 2.3 API Local

**O que é:** A API do projeto rodando na máquina do QA.

**Estrutura do repositório — onde rodar os comandos:**
```
cobranca-saas-api/          ← PASTA RAIZ DO REPO (package.json aqui)
  src/
  migrations/
  package.json
  .env
  Projeto_CobrancaBoleto/   ← pasta de docs e postman (NÃO é aqui)
    postman/
    docs/
```

> ⚠️ Todos os comandos `npm run *` devem ser executados na **pasta raiz do repo** (`cobranca-saas-api/`), **não** dentro de `Projeto_CobrancaBoleto/`.

**Como subir:**
```bash
# Navegar para a pasta raiz do repo (exemplo Windows)
cd "C:\Users\<seu-usuario>\...\cobranca-saas-api"

# Confirmar que está no lugar certo — deve ver package.json
ls package.json   # Windows PowerShell: dir package.json

# 1. Atualizar código
git checkout main && git pull origin main

# 2. Dependências
npm ci

# 3. Rodar migrations (obrigatório — Sprint L adicionou colunas)
npm run migrate
# Confirmar que migrations 025 e 026 aparecem na saída

# 4. Subir API
npm run dev
# API deve iniciar em http://localhost:3334

# 5. Verificar health
curl http://localhost:3334/health
# Esperado: { "status": "ok" }
```

> ⚠️ **Não usar Docker em :3333** sem rebuild — imagem pode estar desatualizada (sem rotas `/gateway/*` e sem coluna `gateway_credentials_encrypted`). A fábrica confirmou esse problema.

**Pré-requisitos locais:**
- Node.js 20
- PostgreSQL 16 rodando (local ou Docker)
- Redis rodando (BullMQ + token cache)
- Arquivo `.env` com `DATABASE_URL`, `REDIS_URL`, `ENCRYPTION_KEY`, `JWT_SECRET`

### 2.4 Postman

**Versão mínima:** Postman 10.x

**Arquivos para importar** (pasta `postman/` do repo):

| Arquivo | Tipo | Ação |
|---|---|---|
| `Inter_Sandbox.postman_collection.json` | Collection — chamadas diretas ao Inter | Import |
| `Inter_Sandbox.postman_environment.json` | Environment sandbox direto | Import |
| `Inter_Gateway_Homolog.postman_collection.json` | Collection — testes via API própria | Import (quando entregue pela fábrica) |
| `Inter_Gateway_Homolog.local.postman_environment.json` | Environment local (com secrets) | Criar localmente via `npm run postman:inter:setup-local` |

**Configuração mTLS no Postman** (obrigatório para pasta 3 e Inter_Sandbox):
1. Postman → **Settings (⚙️) → Certificates**
2. Clique **Add Certificate**
3. **Host:** `cdpj-sandbox.partners.uatinter.co`
4. **CRT file:** selecionar `Inter_API_Certificado.crt`
5. **KEY file:** selecionar `Inter_API_Chave.key`
6. Salvar. Não é necessário passphrase para certificados sandbox.

### 2.5 Tenant de Teste no Banco de Dados

O QA precisa de um `escritorio` (tenant) configurado para Inter no banco. Após as migrations:

```sql
-- Verificar se existe tenant de teste
SELECT id, nome, gateway_provider FROM escritorios WHERE gateway_provider = 'inter';
```

Se não existir, criar via seed ou request de login + configuração pelo portal (cenário INT-07).

---

## 3. Setup do Ambiente — Passo a Passo

### 3.1 Importar Collections e Environments no Postman

```
Postman → Import → selecionar todos os .json da pasta postman/
```

Após import:
- Selecionar environment `Inter Sandbox` (canto superior direito do Postman)
- Preencher **Current Value** de `inter_client_id` e `inter_client_secret`
- NÃO alterar `inter_base_url` (sandbox já configurado)

### 3.2 Verificar/Converter Certificados PEM

Os certificados baixados do portal podem vir em formato `.crt/.key` (PEM) ou `.pfx` (PKCS#12).

**Verificar se já é PEM:**
```bash
# Se começar com "-----BEGIN CERTIFICATE-----", já é PEM
head -1 Inter_API_Certificado.crt
```

**Converter .pfx para PEM (se necessário):**
```bash
# Extrair certificado
openssl pkcs12 -in certificado.pfx -clcerts -nokeys -out cert.pem

# Extrair chave privada
openssl pkcs12 -in certificado.pfx -nocerts -nodes -out key.pem
```

### 3.3 Configurar Environment Local (Inter_Gateway_Homolog)

Se o script da fábrica estiver disponível:
```bash
# Definir variáveis de ambiente com as credenciais
export INTER_CLIENT_ID="seu-client-id-aqui"
export INTER_CLIENT_SECRET="seu-client-secret-aqui"
export INTER_CERT_PEM="$(cat cert.pem)"
export INTER_KEY_PEM="$(cat key.pem)"

# Gerar arquivo de environment local (gitignored)
npm run postman:inter:setup-local
```

Se o script não estiver disponível, criar manualmente o arquivo `postman/Inter_Gateway_Homolog.local.postman_environment.json` baseado no `.example.json`, preenchendo os campos marcados com `⚠️ PREENCHER`.

---

## 4. Cenários de Teste

### Legenda

| Símbolo | Significado |
|---|---|
| ✅ | Passou no smoke da fábrica |
| ⏳ | Pendente — requer PEM |
| 🔴 | Cenário negativo (deve retornar erro) |
| 🔵 | Teste de portal/configuração |

---

### Pasta 0 — Infraestrutura ✅

#### INT-01 — Health Check da API
**Pré-requisitos:** API local rodando em :3334  
**Request:** `GET http://localhost:3334/health`  
**Resultado esperado:**
- Status HTTP: `200 OK`
- Body: `{ "status": "ok" }`

**Critério de aceite:** API responde em < 500ms.

---

#### INT-02 — Rota gateway/providers disponível
**Pré-requisitos:** Auth token JWT válido (fazer login antes)  
**Request:** `GET http://localhost:3334/api/gateway/providers`  
**Resultado esperado:**
- Status HTTP: `200 OK`
- Body: array com providers; Inter deve aparecer com `enabled: true`

**Critério de aceite:** Inter, Cora e Asaas listados. BB e C6 aparecem mas com `enabled: false` (Sprint M).

---

### Pasta 1 — Autenticação OAuth2 ✅

#### INT-03 — Obter Token Inter (direto ao Inter)
**Collection:** `Inter_Sandbox`  
**Request:** `01 — Obter Token (OAuth2 + mTLS)`  
**Pré-requisitos:** Certificados PEM configurados no Postman (seção 2.4), client_id e client_secret preenchidos  
**Request automático:** POST `{{inter_base_url}}/oauth/v2/token`  
**Resultado esperado:**
- Status HTTP: `200 OK`
- Body contém `access_token` (string longa)
- Body contém `expires_in: 3600`
- Script automático salva token em `{{inter_token}}`

**Critério de aceite:** Token salvo; requests subsequentes funcionam sem configuração adicional.

**Erros comuns:**
- `401 Unauthorized` → client_id ou client_secret errados
- `SSL handshake failed` → certificados PEM não configurados corretamente no Postman
- `ECONNREFUSED` → `inter_base_url` errado ou sem internet

---

#### INT-04 — Token via Gateway API (nossa API)
**Collection:** `Inter_Gateway_Homolog`  
**Pré-requisitos:** Tenant configurado com Inter no banco; API local em :3334  
**O que testa:** Nossa API busca token Inter internamente (Redis cache)  
**Request:** Qualquer request autenticado que aciona o gateway  
**Resultado esperado:** Nosso backend obtém token Inter e faz chamada; QA não vê o token diretamente

**Critério de aceite:** Log da API não apresenta erro de auth; Redis tem key `inter_token::{tenantId}` com TTL ~3540s.

```bash
# Verificar no Redis (opcional):
redis-cli GET "inter_token::seu-tenant-id"
```

---

### Pasta 2 — Configuração de Gateway 🔵✅

#### INT-05 — Configurar credenciais Inter no portal
**Request:** `PATCH http://localhost:3334/api/escritorio/gateway/credentials`  
**Headers:** `Authorization: Bearer {{jwt_token}}`, `Content-Type: application/json`  
**Body:**
```json
{
  "gateway_provider": "inter",
  "credentials": {
    "client_id": "{{inter_client_id}}",
    "client_secret": "{{inter_client_secret}}",
    "cert_pem": "{{inter_cert_pem}}",
    "key_pem": "{{inter_key_pem}}",
    "conta_corrente": "123456789",
    "sandbox": true
  }
}
```
**Resultado esperado:**
- Status HTTP: `200 OK`
- Body: `{ "message": "Credenciais atualizadas com sucesso" }` (ou similar)
- Banco: `escritorio_config.gateway_credentials_encrypted` preenchido; `gateway_provider = 'inter'`

**Critério de aceite:** Campo no banco criptografado (não texto plain); provider atualizado.

---

#### INT-06 — Trocar de gateway (Asaas → Inter)
**Pré-requisitos:** Tenant com Asaas configurado  
**Request:** Mesmo PATCH acima com `gateway_provider: "inter"` e credenciais Inter  
**Resultado esperado:** Troca ocorre sem erro; cobranças existentes (Asaas) não são afetadas; novas cobranças usam Inter

**Critério de aceite:** Log `gateway_change_log` registrado (se implementado em M); emissão futura vai para Inter.

---

#### INT-07 — Listar providers disponíveis
**Request:** `GET http://localhost:3334/api/gateway/providers`  
**Resultado esperado:**
```json
[
  { "id": "asaas", "nome": "Asaas", "enabled": true, "authType": "oauth_basic" },
  { "id": "inter", "nome": "Banco Inter", "enabled": true, "authType": "mtls_oauth" },
  { "id": "cora", "nome": "Cora", "enabled": true, "authType": "mtls_oauth" },
  { "id": "bb", "nome": "Banco do Brasil", "enabled": false },
  { "id": "c6", "nome": "C6 Bank", "enabled": false }
]
```

**Critério de aceite:** BB e C6 aparecem com `enabled: false`; Inter e Cora com `enabled: true`.

---

### Pasta 3 — Emissão Real ⏳ (requer PEM)

> Esta pasta estava bloqueada na entrega da fábrica. Com os PEMs configurados, executar todos os cenários abaixo.

#### INT-08 — Emitir Boleto via Inter (caminho feliz)
**Collection:** `Inter_Sandbox` → `02 — Emitir Boleto`  
**Pré-requisitos:** Token obtido em INT-03; PEM configurado  
**Request:** POST `{{inter_base_url}}/cobrancas/v2`  
**Body (preenchido pelas variáveis do environment):**
```json
{
  "seuNumero": "QA-TEST-001",
  "valorNominal": 10.00,
  "dataVencimento": "2026-07-31",
  "numDiasAgenda": 60,
  "pagador": {
    "cpfCnpj": "11122233344",
    "tipoPessoa": "FISICA",
    "nome": "QA Teste Pagador",
    "email": "qa@teste.com",
    "telefone": "991234567",
    "ddd": "31",
    "endereco": "Rua de Teste QA, 123",
    "bairro": "Centro",
    "cidade": "Belo Horizonte",
    "uf": "MG",
    "cep": "30140071"
  }
}
```
**Resultado esperado:**
- Status HTTP: `200 OK` ou `202 Accepted`
- Body contém `codigoSolicitacao` (UUID) — salvo automaticamente em `{{inter_codigo_solicitacao}}`
- `situacao` pode ser `EM_PROCESSAMENTO` (aguardar 30–60s) ou `A_VENCER`

**Critério de aceite:** `codigoSolicitacao` salvo; nenhum erro 4xx/5xx.

---

#### INT-09 — Emitir Boleto via Nossa API (caminho feliz)
**Pré-requisitos:** Tenant configurado com Inter (INT-05); PEM cadastrado; cobrança criada no sistema  
**Request:** `POST http://localhost:3334/api/cobrancas/{chargeId}/emitir`  
**Headers:** JWT do tenant  
**Resultado esperado:**
- Nossa API aciona `InterAdapter.createBoleto()`
- Status: `200 OK` com `{ "boleto_url": "...", "linha_digitavel": "...", "codigo_barras": "..." }`
- Banco: cobrança com `gateway_transaction_id = codigoSolicitacao` Inter, `status = emitida`
- BullMQ: job de emissão concluído (verificar Redis/logs)

**Critério de aceite:** Linha digitável válida; dados salvos no banco; job sem erro.

---

#### INT-10 — Consultar Status do Boleto
**Collection:** `Inter_Sandbox` → `03 — Consultar Status do Boleto`  
**Pré-requisitos:** INT-08 executado; `inter_codigo_solicitacao` preenchido  
**Request:** `GET {{inter_base_url}}/cobrancas/v2/{{inter_codigo_solicitacao}}`  
**Resultado esperado:**
- Status HTTP: `200 OK`
- Body: objeto com `situacao` = `A_VENCER` (ou `EM_PROCESSAMENTO` se muito recente)
- Campos: `codigoSolicitacao`, `seuNumero`, `valorNominal`, `dataVencimento`, `linhaDigitavel`

**Critério de aceite:** UUID bate com o emitido; valor correto; linha digitável presente.

---

#### INT-11 — Download do PDF do Boleto
**Collection:** `Inter_Sandbox` → `05 — Baixar PDF do Boleto`  
**Pré-requisitos:** INT-08 executado; boleto em `A_VENCER` (não `EM_PROCESSAMENTO`)  
**Request:** `GET {{inter_base_url}}/cobrancas/v2/{{inter_codigo_solicitacao}}/pdf`  
**Resultado esperado:**
- Status HTTP: `200 OK`
- `Content-Type: application/pdf`
- Tamanho > 1.000 bytes
- Postman: aba "Body" → "Save response" → arquivo PDF abre corretamente

**Critério de aceite:** PDF abre; contém QR code ou linha digitável visual; razão social Exeq visível.

---

#### INT-12 — Cancelar Boleto
**Collection:** `Inter_Sandbox` → `04 — Cancelar Boleto`  
**Pré-requisitos:** INT-08 executado; boleto em `A_VENCER` (não pago)  
**Request:** `POST {{inter_base_url}}/cobrancas/v2/{{inter_codigo_solicitacao}}/cancelar`  
**Body:**
```json
{ "motivoCancelamento": "ACERTOS" }
```
**Resultado esperado:**
- Status HTTP: `204 No Content` (sem body — isso é correto)
- Consultar status (INT-10) após: `situacao = CANCELADO`

**Critério de aceite:** 204 recebido; consulta posterior mostra `CANCELADO`.

---

### Cenários Negativos 🔴

#### INT-N1 — Token expirado / inválido
**Request:** Qualquer request autenticado Inter com `{{inter_token}}` alterado para valor inválido  
**Resultado esperado:** Status `401 Unauthorized`; body com código de erro Inter  
**Critério de aceite:** Nossa API detecta 401 do Inter e retorna erro apropriado ao cliente (não expõe token).

---

#### INT-N2 — SeuNumero duplicado
**Pré-requisitos:** INT-08 executado com `seuNumero = "QA-TEST-001"`  
**Ação:** Executar INT-08 novamente com mesmo `seuNumero`  
**Resultado esperado:** Status `422` ou `409` do Inter; mensagem de erro clara  
**Mitigação:** Incrementar para `QA-TEST-002` na próxima emissão.

---

#### INT-N3 — Data de vencimento no passado
**Ação:** Alterar `inter_data_vencimento` para data passada (ex: `2020-01-01`) e emitir  
**Resultado esperado:** Erro de validação Inter ou nossa API rejeita antes de chamar Inter  
**Critério de aceite:** Erro claro; sem boleto fantasma criado.

---

#### INT-N4 — CPF/CNPJ com formato inválido
**Ação:** Alterar `inter_pagador_cpfcnpj` para valor com letras ou comprimento errado  
**Resultado esperado:** Erro 422 Inter ou validação nossa API  
**Critério de aceite:** Mensagem descritiva; não gera boleto.

---

#### INT-N5 — Credenciais Inter não configuradas no tenant
**Pré-requisitos:** Tenant sem `gateway_credentials_encrypted`  
**Ação:** Tentar emitir boleto via nossa API  
**Resultado esperado:** Nossa API retorna erro `GatewayCredentialsMissingError` ou similar  
**Critério de aceite:** HTTP 422 ou 400 com mensagem clara; não trava o worker.

---

#### INT-N6 — Provider não suportado
**Ação:** Tentar configurar `gateway_provider = "santander"` via PATCH  
**Resultado esperado:** Nossa API retorna `400 Bad Request`; CHECK de banco rejeita valor  
**Critério de aceite:** Erro antes de chegar ao banco ou rejeição do Postgres.

---

## 5. Prioridade de Execução

Execute nesta ordem. Pare e registre bug se qualquer bloqueador impedir continuidade:

```
INT-01 → INT-02 → INT-07          # Infraestrutura (sem PEM)
   ↓
INT-05 → INT-06                   # Configuração gateway (sem PEM)
   ↓
INT-03 → INT-04                   # Token (requer PEM — setup Postman)
   ↓
INT-08 → INT-10 → INT-11 → INT-12 # Emissão completa (requer PEM)
   ↓
INT-09                             # Emissão via nossa API (requer PEM + setup tenant)
   ↓
INT-N1 → INT-N2 → ... → INT-N6   # Negativos (após caminho feliz OK)
```

---

## 6. Critérios de Aceite Globais (Sprint L — Inter)

| # | Critério |
|---|---|
| CA-01 | Tenant configurado para Inter consegue emitir boleto sandbox sem erro |
| CA-02 | `codigoSolicitacao` Inter salvo em `charges.gateway_transaction_id` no banco |
| CA-03 | Tenant Asaas existente **não é afetado** pela Sprint L (zero regressão) |
| CA-04 | `gateway_credentials_encrypted` gravado criptografado (não texto plain) |
| CA-05 | Token Inter não é buscado a cada emissão (Redis com TTL correto) |
| CA-06 | PDF do boleto abre corretamente e tem tamanho > 1KB |
| CA-07 | Cancelamento retorna HTTP 204 e status muda para `CANCELADO` |
| CA-08 | Erros de credencial/config retornam mensagem clara sem expor secrets |
| CA-09 | Migrations 025 e 026 rodam sem erro em banco limpo |

---

## 7. Regressão Asaas (obrigatória antes de fechar Sprint L)

Antes de dar aceite final, executar pelo menos 1 ciclo completo Asaas:

```
POST /api/cobrancas → emitir → consultar status → verificar banco
```

Confirmar que `getGatewayForTenant()` retorna `AsaasAdapter` para tenants Asaas existentes.

---

## 8. Template de Registro de Bug

Use este formato ao abrir issue no repositório:

```markdown
## BUG — [INT-XX] — Título curto

**Cenário:** INT-XX — [nome do cenário]
**Severidade:** Bloqueante | Alta | Média | Baixa
**Ambiente:** localhost:3334 | sandbox Inter | Postman vX.X
**Sprint:** L

### Passos para reproduzir
1. ...
2. ...
3. ...

### Resultado obtido
<!-- O que aconteceu -->

### Resultado esperado
<!-- O que deveria acontecer -->

### Evidências
- Screenshot / print do Postman
- Log da API (terminal)
- Request/Response completo

### Dados de teste usados
- `seu_numero`: ...
- `cpf_pagador`: ...
- Timestamp: ...
```

---

## 9. Evidências a Entregar

Ao concluir os testes, entregar:

| Evidência | Formato | Onde salvar |
|---|---|---|
| Resultado smoke completo | `.md` ou `.html` (Newman) | `docs/evidencias/` |
| Screenshot INT-08 (boleto emitido) | `.png` | `docs/evidencias/` |
| Screenshot INT-11 (PDF aberto) | `.png` | `docs/evidencias/` |
| Screenshot INT-12 (204 cancelamento) | `.png` | `docs/evidencias/` |
| Lista de bugs abertos | Issues no repo | GitHub |
| Sign-off QA | Comentário no PR Sprint L | GitHub PR |

---

## 10. Contato e Escalação

| Dúvida | Falar com |
|---|---|
| Acesso ao portal Inter / certificados | PO — Ricardo |
| Problema com API local (rota não existe, 500) | Fábrica (abrir issue + log) |
| Dúvida sobre comportamento esperado | PO — Ricardo |
| Secret / credencial comprometida | PO imediatamente — rotacionar no portal Inter |

---

*Documento gerado: Maio 2026 — atualizar conforme Sprint M (BB, C6, portal dinâmico)*
