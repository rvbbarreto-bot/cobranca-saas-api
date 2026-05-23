# Guia QA — Configuração Banco Inter (passo a passo)

**Público:** QA sênior · PO · Tech Lead  
**Objetivo:** Obter credenciais no Inter, subir o ambiente local, configurar o gateway no portal SaaS e validar emissão de boleto — com navegação de telas explícita (menu → submenu → botão).  
**Homologação / matriz de testes:** [QA_HOMOLOG_INTER_GATEWAY_PORTAL.md](./QA_HOMOLOG_INTER_GATEWAY_PORTAL.md) · **Evidências:** [evidencias/INTER_HOMOLOG_TEMPLATE.md](./evidencias/INTER_HOMOLOG_TEMPLATE.md) · **Postman:** [postman/README_INTER_HOMOLOG.md](../postman/README_INTER_HOMOLOG.md)

> **Aviso:** O portal [developers.inter.co](https://developers.inter.co/) e o Internet Banking podem alterar rótulos de menu. Se um passo não bater com a UI atual, use a busca do portal por **“Nova integração”**, **“Gestão de aplicações”** ou **“Cobrança”** e registe a divergência no bug/evidência.

---

## 0. Mapa mental (o que você vai fazer)

```mermaid
flowchart LR
  A[Portal Inter<br/>credenciais + PEM] --> B[.env local<br/>API + Redis]
  B --> C[Portal SaaS<br/>Configurações]
  C --> D[Worker emissão]
  D --> E[Boleto emitida<br/>Inter sandbox]
```

| Etapa | Onde | Resultado |
|-------|------|-----------|
| 1 | Inter (externo) | `client_id`, `client_secret`, certificado + chave PEM |
| 2 | Repositório `cobranca-saas-api` | API `:3333`, portal `:5173`, Postgres, Redis |
| 3 | Portal → **Configurações** → **Gateway e integrações** | Gateway `inter` salvo cifrado |
| 4 | Portal → **Boletos** / **Clientes** | Cobrança `rascunho` → `emitida` |

---

## 1. Papéis e pacote de entrega

| Papel | Responsabilidade |
|-------|------------------|
| **PO / Financeiro** | Conta PJ Inter, aprovação SMS/i-safe na criação da integração, download de certificados |
| **Tech Lead** | `.env` com `ENCRYPTION_KEY` estável, Docker/Redis, apoio em erro de fila |
| **QA** | Executar este guia, guardar evidências **sem** secrets, abrir bugs com correlation id |

**Pacote mínimo que o PO deve entregar ao QA (canal seguro — 1Password, não e-mail em claro):**

| # | Item | Formato |
|---|------|---------|
| 1 | Client ID | Texto |
| 2 | Client Secret | Texto |
| 3 | Certificado | Conteúdo PEM (`-----BEGIN CERTIFICATE-----` …) |
| 4 | Chave privada | Conteúdo PEM (`-----BEGIN PRIVATE KEY-----` …) |
| 5 | Ambiente | `sandbox` (homolog) ou `produção` (só após aceite PO) |

---

## 2. Onde pegar os dados na API do Banco Inter

### 2.1 URLs oficiais (referência)

| Uso | Sandbox (homolog) | Produção |
|-----|-------------------|----------|
| Portal documentação | https://developers.inter.co/ | Idem |
| Token OAuth | `POST https://cdpj-sandbox.partners.uatinter.co/oauth/v2/token` | `POST https://cdpj.partners.bancointer.com.br/oauth/v2/token` |
| API cobrança (nosso adapter) | `https://cdpj-sandbox.partners.uatinter.co` + `POST /cobrancas/v2` | Host produção + mesmo path |
| Escopos necessários | `boleto-cobranca.write` · `boleto-cobranca.read` | Idem |

Detalhe técnico de payloads: [ESTUDO_APIS_BANCARIAS.md](../Projeto_CobrancaBoleto/ESTUDO_APIS_BANCARIAS.md) §2.

### 2.2 Caminho A — Portal Developers (recomendado para QA documentar)

#### Passo A.1 — Abrir o portal

1. No browser, aceda a **https://developers.inter.co/**  
2. Clique em **Entrar** / **Login** (canto superior).  
3. Autentique-se com as credenciais da **Conta PJ** autorizada (pode exigir app Inter / i-safe).

#### Passo A.2 — Criar integração (aplicação)

1. Na página inicial ou menu principal, localize a secção **“Soluções para sua empresa”** (ou equivalente **Integrações**).  
2. Clique em **Nova integração** ou **Nova aplicação** (alguns fluxos mostram **Aplicações** → **Nova aplicação**).  
3. Preencha:
   - **Nome da aplicação** — ex.: `Exeq Cobranca SaaS Homolog`
   - **Descrição** — texto livre para auditoria interna  
4. Na etapa de **Permissões** / **APIs**, marque pelo menos:
   - **Cobrança** / **Boleto** — emissão e consulta (rótulos podem aparecer como *Emissão e cancelamento de boletos*, *Consulta de boletos*, *boleto-cobranca*)  
5. Confirme com **Criar** / **Próximo** até concluir.  
6. Se o Inter pedir **validação por SMS** ou **i-safe**, o titular da conta PJ deve aprovar na hora (bloqueio comum em homolog).

#### Passo A.3 — Baixar chaves e certificado

1. Após criar, será redirecionado para a lista de integrações (**Minhas integrações** / **Gestão de aplicações**).  
2. Abra a integração criada (clique no nome).  
3. Localize a área **Chaves e certificados** / **Certificados** / **Download**.  
4. Baixe os ficheiros que o Inter disponibilizar, tipicamente:
   - Certificado público (`.crt` ou `.pem`)
   - Chave privada (`.key`)
   - Opcional: `.pfx` (não usamos diretamente no SaaS — converter para PEM se necessário)  
5. Na mesma ecrã ou separado, copie:
   - **Client ID**  
   - **Client Secret** (só aparece na criação em alguns fluxos — se perdeu, gere novo secret conforme portal)

#### Passo A.4 — Converter ficheiros para PEM (se vier .crt + .key)

O portal SaaS espera **texto PEM colado** nos campos, não upload de ficheiro.

**Windows (PowerShell) — exemplo:**

```powershell
Get-Content -Raw "C:\Downloads\Inter_API_Certificado.crt"
Get-Content -Raw "C:\Downloads\Inter_API_Chave.key"
```

**Validação rápida:**

- Certificado começa com `-----BEGIN CERTIFICATE-----`  
- Chave começa com `-----BEGIN PRIVATE KEY-----` ou `-----BEGIN RSA PRIVATE KEY-----`  
- Não misturar chave pública no campo “Chave privada PEM”

#### Passo A.5 — (Opcional) Testar credenciais **fora** do SaaS

Antes de culpar o produto, valide no Postman **direto no Inter**:

1. Request `POST` → URL sandbox do token (§2.1).  
2. Aba **Settings → Certificates**: anexe `.crt` + `.key` (mTLS no TLS).  
3. Body `x-www-form-urlencoded`: `grant_type=client_credentials`, `client_id`, `client_secret`, `scope=boleto-cobranca.write boleto-cobranca.read`.  
4. Esperado: HTTP **200** e `access_token`.  
5. Se falhar aqui → corrigir credenciais com PO; **não** abrir bug P0 no SaaS ainda.

Documentação de referência no portal: menu **Referências** → **Cobrança (Boleto)** / **Cobrança BolePix**.

### 2.3 Caminho B — Internet Banking (alternativa citada por integradores)

Algumas empresas criam a aplicação pelo banking em vez do site developers:

1. Login **Internet Banking Inter** (Conta PJ).  
2. Menu **Conta Digital** (ou **Mais**) → **Integrações** / **APIs** / **Aplicações**.  
3. **Nova aplicação** → mesmas permissões de **Cobrança**.  
4. Download de certificados em **Gestão de aplicações**.

Use o caminho que o PO da sua organização já tiver homologado; o mapeamento para o SaaS (§4) é o mesmo.

### 2.4 O que **não** vai para o portal SaaS

| Dado Inter | Usado pelo adapter? | Campo no SaaS |
|------------|---------------------|---------------|
| Conta corrente / CNPJ beneficiário | Sim (conta vinculada à app Inter) | **Não** pedido na UI hoje — conta está na app Inter |
| `X-Inter-Conta-Corrente` (header em alguns exemplos) | Pode ser exigido pelo Inter em cenários específicos | Não exposto no formulário atual |
| PDF do boleto | API Inter `GET .../pdf` | Placeholder `inter://...` no produto (limitação conhecida) |

---

## 3. Mapeamento: Inter → formulário do SaaS

Quando no portal SaaS escolher **Banco Inter**, estes são os **rótulos exatos** do formulário (registry):

| Campo na UI (portal) | Chave JSON (`gateway_credentials`) | Origem no Inter |
|----------------------|--------------------------------------|-----------------|
| Client ID | `client_id` | Portal integração |
| Client Secret | `client_secret` | Portal integração |
| Certificado PEM | `certificate_pem` | Conteúdo do `.crt` / certificado |
| Chave privada PEM | `private_key_pem` | Conteúdo do `.key` |

Após salvar, o servidor guarda em `escritorio_config.gateway_credentials_encrypted` (AES). A UI mostra: *“Credenciais já configuradas (valores mascarados no servidor).”*

---

## 4. Ambiente local — passo a passo (nosso sistema)

### 4.1 Pré-requisitos na máquina QA

| Software | Verificação |
|----------|-------------|
| Node.js 20+ | `node -v` |
| Docker Desktop | `docker ps` sem erro |
| Git | clone do repo `cobranca-saas-api` |

### 4.2 Subir banco e Redis

**Opção recomendada (Windows):**

1. Abra **PowerShell**.  
2. `cd` até a raiz do repositório (pasta que contém `package.json`).  
3. Execute:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/dev-up.ps1
```

4. Confirme containers:

```powershell
docker compose ps
```

Esperado: serviços `postgres` e `redis` **running** (e `api` se o script subir).

**Referência completa:** [LOCAL_DOCKER_SETUP.md](./LOCAL_DOCKER_SETUP.md)

### 4.3 Configurar `.env` da API

1. Na raiz do repo, copie `.env.example` → `.env` (se ainda não existir).  
2. Preencha no mínimo:

| Variável | Exemplo / nota |
|----------|----------------|
| `DATABASE_URL` | `postgres://app:<senha>@localhost:5434/cobranca_saas` — porta **5434** no host |
| `JWT_SECRET` | ≥ 32 caracteres aleatórios |
| `ENCRYPTION_KEY` | 64 caracteres hex (`openssl rand -hex 32`) — **não mudar** durante a homolog |
| `REDIS_URL` | `redis://localhost:6379` (ou URL do compose) |
| `GATEWAY_INTER_ENABLED` | `true` (default) |

3. **Não** coloque PEM do Inter no `.env` — credenciais Inter vão pelo portal ou Postman.

### 4.4 Migrar e seed

No mesmo diretório:

```bash
npm ci
npm run migrate
npm run seed:dev
```

### 4.5 Subir API e portal (dois terminais)

**Terminal 1 — API:**

```bash
npm run dev
```

**Terminal 2 — Portal web:**

```bash
npm run portal:dev
```

### 4.6 Checklist de “ambiente no ar”

| # | Ação | URL / comando | Esperado |
|---|------|---------------|----------|
| E1 | Health API | http://localhost:3333/health | JSON com `status: ok` |
| E2 | Ready API | http://localhost:3333/health/ready | Postgres OK |
| E3 | Login portal | http://localhost:5173/login | Formulário **Entrar** |
| E4 | Logs API | Terminal 1 | Sem crash; ao emitir, linhas `[payment-emission]` |

**Credenciais seed (dev):**

| Campo | Valor |
|-------|--------|
| E-mail | `portal-seed@local.dev` |
| Tenant / Escritório | `escritorio-demo` |
| Senha | `PortalSeedDev!ChangeMe1` |
| Papel necessário | `admin_escritorio` (para editar gateway) |

---

## 5. Portal SaaS — navegação UI (passo a passo)

### 5.1 Entrar no portal

1. Browser → **http://localhost:5173/login**  
2. Painel direito **Entrar**:
   - **E-mail corporativo** → `portal-seed@local.dev`  
   - **Senha** → senha seed  
   - **Tenant / Escritório** → `escritorio-demo`  
3. Botão **Entrar no portal**  
4. Esperado: redirecionamento para **Dashboard** (`/dashboard`).  
5. Barra lateral esquerda (menu **EXEQ · Cobrança & Boletos**) deve mostrar, entre outros:
   - Dashboard  
   - Clientes  
   - Boletos  
   - Cobrança recorrente  
   - Notificações  
   - Auditoria  
   - **Configurações** ← destino da config Inter  

**Cabeçalho superior:** deve aparecer o seu nome/e-mail e o papel `admin_escritorio`. Se aparecer `operador` ou `viewer`, não conseguirá salvar gateway (ver §5.2).

### 5.2 Configurar gateway Banco Inter

1. Na **barra lateral**, clique em **Configurações** (último item principal antes de “Ferramentas”).  
2. URL esperada: **http://localhost:5173/configuracoes**  
3. Título da página: **Configurações do escritório**  
4. Abaixo do título, há **três botões de aba** (toolbar):
   - **Gateway e integrações** ← clique aqui (aba ativa = estilo primário)  
   - Régua de cobrança  
   - Templates  
5. No cartão **Gateway e integrações**:
   - Campo **Razão social** — opcional para teste  
   - Campo **Gateway** (dropdown) → abra e selecione **Banco Inter**  
6. Após selecionar Inter, aparecem **quatro campos** adicionais:
   - **Client ID** (texto)  
   - **Client Secret** (password)  
   - **Certificado PEM** (área de texto grande)  
   - **Chave privada PEM** (área de texto grande)  
7. Cole os valores do pacote PO (§1).  
   - Dica: cada PEM em bloco único, com quebras de linha reais.  
8. Role até o botão **Guardar configurações** (rodapé do formulário) e clique.  
9. Esperado:
   - Faixa verde: **Configurações guardadas.**  
   - Texto cinza: **Credenciais já configuradas (valores mascarados no servidor).**  
10. Pressione **F5** (recarregar).  
    - **Gateway** continua **Banco Inter**  
    - Campos secretos vazios com placeholder *“Deixe em branco para manter”*  
11. (Teste INT-04) Deixe PEM em branco e **Guardar configurações** de novo → não deve apagar credenciais.

**Secção histórico:** se já houve troca de gateway, lista **Últimas trocas de gateway** (ex.: `asaas → inter` + data).

**Se vir banner amarelo** *“Apenas utilizadores com papel admin_escritorio…”* → utilizador errado; peça ao TL ajuste no seed ou outro login.

### 5.3 Cadastrar cliente (pré-requisito da cobrança)

1. Barra lateral → **Clientes** (`/clientes`).  
2. Título **Clientes** → botão superior direito **Novo cliente**.  
3. URL: `/clientes/novo` — preencha **documento** (CPF/CNPJ válido), **nome**, **e-mail**, **telefone** conforme formulário.  
4. Salve e volte à lista; clique na linha do cliente para abrir **detalhe**.  
5. No detalhe, existe atalho **Nova cobrança** (leva à criação com `clienteId` na query).

### 5.4 Emitir boleto (fluxo feliz)

**Pré-condição:** gateway Inter salvo (§5.2) + Redis/fila ativos (§4.5).

1. Barra lateral → **Boletos** (`/cobrancas`).  
2. Botão **Nova cobrança** (canto superior direito).  
3. URL: `/cobrancas/nova` — título **Nova cobrança**  
4. Preencha **Dados**:
   - **Referência** — ex.: `QA-INTER-001`  
   - **Valor** — ex.: `150,75`  
   - **Vencimento** — data futura  
   - **Cliente** — selecione o cliente criado em §5.3  
5. Submeta o formulário (botão de criar/salvar no cartão).  
6. Esperado: redirecionamento para **detalhe da cobrança** `/cobrancas/{uuid}`.  
7. Status inicial: **rascunho** (pode aparecer em pill/badge na UI).  
8. Aguarde **5–30 segundos** (fila + Inter pode responder `EM_PROCESSAMENTO`).  
9. Atualize a página (**F5**) ou volte à lista **Boletos** e reabra o registro.  
10. Esperado homolog P0: status **emitida**; no painel de pagamento, linha digitável / código de barras **se** o sandbox Inter devolveu.  
11. URL do PDF pode ser placeholder `inter://cobranca/...` — **não reprova** homolog P0 se emissão e `provider_charge_id` OK (ver limitações no roteiro homolog).

### 5.5 Consultar lista de boletos

1. **Boletos** → toolbar **Filtrar por status** → pode filtrar **Emitida** / **Erro emissão** para achar o caso.  
2. Clique na linha para reabrir o detalhe.

### 5.6 Troca de gateway (cenário INT-07)

1. **Configurações** → aba **Gateway e integrações**.  
2. Altere dropdown **Gateway** de **Banco Inter** para outro (ex.: **Asaas**) e preencha credenciais desse provider.  
3. **Guardar configurações**.  
4. Verifique lista **Últimas trocas de gateway** na mesma página.  
5. Cobranças **já emitidas** no Inter **não migram** — só novas cobranças usam o gateway atual.

---

## 6. Configuração via Postman (alternativa à UI)

Útil para isolar API antes da UI ou para evidência JSON.

1. Postman → **Import** → ficheiros:
   - `postman/Inter_Gateway_Homolog.postman_collection.json`
   - `postman/Inter_Gateway_Homolog.postman_environment.json`  
2. Environment **Inter Gateway Homolog — Local** → preencha `interClientId`, `interClientSecret`, PEM (quebras de linha reais).  
3. Ordem no **Collection Runner**:
   - `0 — Health`  
   - `1 — Auth` (grava `portalToken`)  
   - `2 — Gateway Inter`  
   - Aguardar worker  
   - `3 — Cobrança` — repetir **GET cobrança** até `canonicalStatus` = `emitida`  

Detalhe: [postman/README_INTER_HOMOLOG.md](../postman/README_INTER_HOMOLOG.md)  
CLI: `npm run postman:inter:smoke` · resultado TL: [evidencias/postman-inter-homolog-SMOKE-RESULT.md](./evidencias/postman-inter-homolog-SMOKE-RESULT.md)

**Header obrigatório nas rotas portal (exceto login):** `x-tenant-id: 1` (tenant automação do seed) + `Authorization: Bearer <token>`.

---

## 7. Validação técnica (QA com DB ou API)

### 7.1 API — config mascarada

```http
GET http://localhost:3333/v1/portal/escritorio/config
Authorization: Bearer <token>
```

Esperado: `gateway_provider: "inter"`, `gateway_credentials_configured: true`, **sem** PEM/secret em claro.

### 7.2 SQL (ajustar tenant público se necessário)

```sql
SELECT gateway_provider, gateway_credentials_configured
FROM escritorio_config
ORDER BY updated_at DESC
LIMIT 5;

SELECT id, canonical_status, provider, provider_charge_id
FROM charges
ORDER BY created_at DESC
LIMIT 5;

SELECT gateway, gateway_transaction_id, boleto_barcode
FROM payment_transactions
ORDER BY created_at DESC
LIMIT 5;
```

Esperado: `provider` / `gateway` = `inter`; `provider_charge_id` / `gateway_transaction_id` = UUID (`codigoSolicitacao` Inter).

---

## 8. Troubleshooting (mensagens que o QA vê)

| Sintoma | Causa provável | Ação |
|---------|----------------|------|
| Login portal 401 | Tenant errado | Use slug `escritorio-demo`, não UUID, no campo Tenant |
| Configurações sem dropdown Inter | `GATEWAY_INTER_ENABLED=false` | `.env` → `true` e reiniciar API |
| Banner admin_escritorio | Papel insuficiente | Login seed admin ou utilizador correto |
| Cobrança presa em **rascunho** | Redis parado / worker | Subir Redis; ver logs `[payment-emission]` |
| **erro_emissao** imediato | PEM errado, secret errado, escopo | Refazer §2.5; validar token direto no Inter |
| 403 em PATCH gateway | Não é `admin_escritorio` | Trocar utilizador |
| Placeholder PDF `inter://...` | Limitação produto | Documentar como conhecido; validar barcode/UUID |
| PIX com gateway Inter falha | Esperado (INT-09) | Adapter não suporta PIX Inter |

---

## 9. Evidências e documentos relacionados

| Documento | Uso |
|-----------|-----|
| [INTER_HOMOLOG_TEMPLATE.md](./evidencias/INTER_HOMOLOG_TEMPLATE.md) | Colar resultados e screenshots |
| [QA_HOMOLOG_INTER_GATEWAY_PORTAL.md](./QA_HOMOLOG_INTER_GATEWAY_PORTAL.md) | Matriz INT-01…09 e critérios de aceite |
| [GATEWAY_UNIVERSAL.md](./GATEWAY_UNIVERSAL.md) | Arquitetura factory/adapters |
| [QA_GUIA_TESTES_BDD.md](./QA_GUIA_TESTES_BDD.md) | Índice geral de testes |

**Screenshots sugeridos (`docs/evidencias/prints/`):**

1. Login preenchido (senha borrada)  
2. Configurações → aba **Gateway e integrações** → **Banco Inter** selecionado (PEM borrado)  
3. Banner **Configurações guardadas**  
4. Detalhe cobrança **emitida**  
5. Lista **Últimas trocas de gateway** (se aplicável)  

---

## 10. Checklist rápido QA (antes de pedir aceite PO)

- [ ] Token OAuth Inter OK (teste direto ou emissão SaaS)  
- [ ] Ambiente E1–E4 OK  
- [ ] Portal: **Configurações** → **Gateway e integrações** → **Banco Inter** guardado  
- [ ] Pelo menos 1 boleto **emitida** com gateway `inter`  
- [ ] Evidência SQL ou GET sem vazamento de secrets  
- [ ] Template de homolog preenchido e arquivado  

---

*Última atualização: Maio 2026 · Alinhado ao portal `apps/portal-web` e registry `Banco Inter`.*
