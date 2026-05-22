# Guia de testes — Time QA (PO + Tech Lead)

**Produto:** SaaS Cobranças (API + Portal web)  
**Repositório:** [github.com/rvbbarreto-bot/cobranca-saas-api](https://github.com/rvbbarreto-bot/cobranca-saas-api)  
**Versão do guia:** Maio 2026 (pós Sprint I + Sprint J)  
**Público:** QA júnior / homologação manual + workflow GitHub

---

## 1. Objetivo deste documento

Orientar o time de QA a:

1. Subir o ambiente **local** (portal + API) e validar fluxos de negócio em BDD.
2. Configurar e executar o workflow **Asaas E2E (manual)** no GitHub Actions.
3. Registrar evidências no checklist Sprint 1 sem expor segredos no Git.

**Fora de escopo nesta rodada:** produção real Asaas live, NFS-e, OAuth/IdP externo, merge de PRs.

---

## 2. Ambientes e URLs

### 2.1 Desenvolvimento local (principal para QA de portal)


| Serviço                                                    | URL                                                          | Observação                                                               |
| ---------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------ |
| **Portal web (SPA)**                                       | [http://localhost:5173](http://localhost:5173)               | `npm run portal:dev`                                                     |
| **API (HTTP)**                                             | [http://localhost:3333](http://localhost:3333)               | `npm run dev`                                                            |
| **Health (liveness)**                                      | [http://localhost:3333/health](http://localhost:3333/health) | Esperado: `200`, `status: ok`                                            |
| **Readiness**                                              |                                                              | Esperado: `200` com DB migrado                                           |
| **Login portal**                                           |                                                              | [http://localhost:3333/health/ready](http://localhost:3333/health/ready) |
| [http://localhost:5173/login](http://localhost:5173/login) | Formulário e-mail + tenant + senha                           |                                                                          |
| **Asaas Sandbox (painel)**                                 | [https://sandbox.asaas.com/](https://sandbox.asaas.com/)     | Conta sandbox para chave API                                             |


O Vite do portal faz **proxy** de `/v1` → `http://localhost:3333` quando `VITE_API_BASE_URL` está vazio (padrão).

### 2.2 Docker Compose (opcional, mesma API na porta 3333)


| Item            | Valor                                                        |
| --------------- | ------------------------------------------------------------ |
| Health          | [http://localhost:3333/health](http://localhost:3333/health) |
| Postgres (host) | `localhost:5434` (ver `.env.example`)                        |
| Guia            | [LOCAL_DOCKER_SETUP.md](./LOCAL_DOCKER_SETUP.md)             |


### 2.3 GitHub Actions (homolog Asaas automatizada)


| Item                            | URL                                                                                                                                                                                      |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lista de workflows              | [https://github.com/rvbbarreto-bot/cobranca-saas-api/actions](https://github.com/rvbbarreto-bot/cobranca-saas-api/actions)                                                               |
| Workflow **Asaas E2E (manual)** | [https://github.com/rvbbarreto-bot/cobranca-saas-api/actions/workflows/asaas-e2e-manual.yml](https://github.com/rvbbarreto-bot/cobranca-saas-api/actions/workflows/asaas-e2e-manual.yml) |
| Secrets do repositório          | [https://github.com/rvbbarreto-bot/cobranca-saas-api/settings/secrets/actions](https://github.com/rvbbarreto-bot/cobranca-saas-api/settings/secrets/actions)                             |


**Não existe URL pública de “staging”** documentada neste projeto: homolog = **local** ou **workflow manual** no GitHub.

### 2.4 Rotas do portal (SPA) — base `http://localhost:5173`


| Rota                          | O que testar                       |
| ----------------------------- | ---------------------------------- |
| `/login`                      | Autenticação                       |
| `/dashboard`                  | Área autenticada                   |
| `/cobrancas`                  | Lista + Carregar mais              |
| `/cobrancas/nova`             | Criar cobrança                     |
| `/cobrancas/:id`              | Detalhe boleto/PIX                 |
| `/cobrancas/:id/editar`       | Editar valor/vencimento (Sprint F) |
| `/clientes`                   | Lista clientes                     |
| `/clientes/novo`              | Novo cliente                       |
| `/clientes/:id`               | Detalhe + cobranças do cliente     |
| `/clientes/:id/editar`        | Editar cliente                     |
| `/configuracoes`              | Gateway, régua, templates (admin)  |
| `/escritorio`                 | Plano / assinatura / billing link  |
| `/relatorios`                 | Export CSV                         |
| `/notas-fiscais`              | Lista NF (pode estar vazia)        |
| `/ajuda/provisionamento-core` | Texto de ajuda (somente leitura)   |


Contrato HTTP completo: [API_CONTRATO_E_SMOKE.md](./API_CONTRATO_E_SMOKE.md).

---

## 3. Pré-requisitos — ambiente local

### 3.1 Software

- Node.js **20**
- PostgreSQL acessível (local ou Docker do projeto)
- Redis (recomendado se testar filas/workers; E2E script pode rodar emissão síncrona)
- Conta **Asaas Sandbox** + API Key (`$aact_...`) — só para testes Asaas

### 3.2 Comandos iniciais (raiz do repo)

**Opção A — Docker (recomendado para QA):**

```powershell
git clone https://github.com/rvbbarreto-bot/cobranca-saas-api.git
cd cobranca-saas-api
copy .env.example .env
# Confirmar: DB_PASSWORD=dev_only e DATABASE_URL com porta 5434 (nao 5432)
powershell -ExecutionPolicy Bypass -File scripts/dev-up.ps1
npm run portal:dev
```

**Opção B — API no host (`npm run dev`):** exige Postgres em `localhost:5434` e Redis publicado (ver [LOCAL_DOCKER_SETUP.md](./LOCAL_DOCKER_SETUP.md)).


| Serviço  | Como sobe              | URL                                            |
| -------- | ---------------------- | ---------------------------------------------- |
| API      | Docker `api` (opção A) | [http://localhost:3333](http://localhost:3333) |
| Portal   | `npm run portal:dev`   | [http://localhost:5173](http://localhost:5173) |
| Postgres | Docker `postgres`      | host `localhost:5434`                          |


### 3.3 Credenciais de teste (seed — **somente dev**)


| Campo             | Valor                                                  |
| ----------------- | ------------------------------------------------------ |
| E-mail            | `portal-seed@local.dev`                                |
| Tenant ID (slug)  | `escritorio-demo`                                      |
| Senha padrão      | `PortalSeedDev!ChangeMe1`                              |
| Senha customizada | Valor de `SEED_PORTAL_PASSWORD` no `.env`, se definido |


Papel esperado após login: **admin_escritorio** (acesso a `/configuracoes`).

**Nunca** usar estas credenciais em produção real.

### 3.4 Variáveis `.env` para testes Asaas locais


| Variável               | Obrigatório (E2E Asaas) | Exemplo / nota                                    |
| ---------------------- | ----------------------- | ------------------------------------------------- |
| `DATABASE_URL`         | Sim                     | `postgres://app:...@localhost:5434/cobranca_saas` |
| `ASAAS_API_KEY`        | Sim                     | Chave sandbox `$aact_...`                         |
| `ASAAS_API_URL`        | Não                     | Default: `https://sandbox.asaas.com/api/v3`       |
| `ENCRYPTION_KEY`       | Sim                     | 64 caracteres hex (`openssl rand -hex 32`)        |
| `WEBHOOK_INBOX_SECRET` | Sim                     | `openssl rand -hex 32`                            |
| `JWT_SECRET`           | Sim                     | ≥ 32 caracteres                                   |


Comando local de evidência:

```bash
npm run e2e:asaas:evidence
```

Checklist PO: [evidencias/SPRINT1_ACEITE_CHECKLIST.md](./evidencias/SPRINT1_ACEITE_CHECKLIST.md).

### 3.5 Workflows n8n (import JSON — Sprint E homolog)

| Arquivo | Caminho no repositório |
|---------|------------------------|
| Outbound (API → n8n) | `docs/n8n/workflows/cobranca-saas-events.workflow.json` |
| Inbound homolog (n8n → API) | `docs/n8n/workflows/cobranca-saas-inbox-homolog.workflow.json` |
| Guia completo | [docs/n8n/README.md](./n8n/README.md) |

1. Importar no n8n → **Activate** o workflow outbound.
2. Copiar URL de produção do webhook → `N8N_PLATFORM_WEBHOOK_URL` no `.env` da API.
3. Alinhar secrets (`N8N_PLATFORM_WEBHOOK_SECRET`, `WEBHOOK_INBOX_SECRET`) na API e variáveis do n8n.
4. `npm run n8n:smoke:outbound` — envia os 6 eventos de teste.

### 3.6 Automação Playwright E2E (BDD no repositório)

Suíte em `e2e/tests/` — cobre os cenários Gherkin da secção 6 com monitorização de rede (status HTTP) e consola.

| Comando | Uso |
| ------- | --- |
| `npm run e2e:playwright:install` | Instala browsers (primeira vez) |
| `npm run e2e:playwright` | Executa todos os cenários |
| `npm run e2e:playwright:ui` | Modo interativo (depuração) |

**Pré-requisitos:** API em `:3333`, portal em `:5173`, `npm run migrate`, `npm run seed:dev` (inclui **55+ cobranças** para paginação — ver `SEED_PAGINATION_CHARGE_MIN`).

**Relatórios gerados após cada run:**

| Ficheiro | Conteúdo |
| -------- | -------- |
| [evidencias/cenarios_testes.md](./evidencias/cenarios_testes.md) | Tabela Passou / Falhou / Ignorado por cenário |
| [evidencias/asaas-e2e-result.json](./evidencias/asaas-e2e-result.json) | JSON técnico (Playwright + homolog Asaas) |

**`.env` e Docker:** o Playwright carrega `.env` com `override: true` para coincidir com o container `api`. Se `WEBHOOK_INBOX_SECRET` no terminal (CI) for diferente do `.env`, reinicie `docker compose up -d api` ou desdefina a variável no shell antes do teste.

**Asaas script completo no Playwright:** só corre com `RUN_ASAAS_E2E=1` e `ASAAS_API_KEY` sandbox no `.env`.

### 3.7 Cenários Playwright que podem ficar **Ignorados** (skip)

| Cenário BDD | Motivo do skip | Como fazer passar |
| ----------- | -------------- | ----------------- |
| Carregar mais (paginação) | Menos de 50 cobranças no tenant | `npm run seed:dev` (insere até 55 cobranças `SEED-PAG-QA-*` se necessário) |
| Cobrança paga não permite edição | Nenhuma cobrança com status `paga` no ambiente | Inserir cobrança paga no DB ou marcar uma via webhook de teste |
| Utilizador sem perfil admin não acessa | Seed só cria `admin_escritorio` | Criar membership `operador` manualmente ou ampliar seed |
| Script completo com ambiente válido (Asaas) | Proteção: não chama sandbox sem opt-in | `set RUN_ASAAS_E2E=1` (PowerShell) + `.env` com `ASAAS_API_KEY` + `npm run e2e:playwright` |

Cenários **Homolog Asaas — workflow GitHub** validam o YAML e templates localmente; o disparo real continua no Actions (secção 4).

---

## 4. Configuração do workflow GitHub — **Asaas E2E (manual)**

Workflow: `.github/workflows/asaas-e2e-manual.yml`  
Nome na UI: **Asaas E2E (manual)**  
**Não roda** em push nem em PR — apenas disparo manual.

### 4.1 O que o Tech Lead deve configurar (uma vez)

1. Abrir: [https://github.com/rvbbarreto-bot/cobranca-saas-api/settings/secrets/actions](https://github.com/rvbbarreto-bot/cobranca-saas-api/settings/secrets/actions)
2. Clicar **New repository secret**
3. Criar:


| Nome do secret  | Valor                                   | Quem fornece            |
| --------------- | --------------------------------------- | ----------------------- |
| `ASAAS_API_KEY` | API Key **sandbox** Asaas (`$aact_...`) | PO / financeiro sandbox |


**Não é necessário** criar secrets para `DATABASE_URL`, `JWT_SECRET`, `ENCRYPTION_KEY` etc. — o workflow já define valores de CI internos (Postgres e Redis efêmeros no runner).

### 4.2 Como o QA dispara o workflow

1. Ir em: [https://github.com/rvbbarreto-bot/cobranca-saas-api/actions/workflows/asaas-e2e-manual.yml](https://github.com/rvbbarreto-bot/cobranca-saas-api/actions/workflows/asaas-e2e-manual.yml)
2. Botão **Run workflow** (canto direito)
3. Branch: `main` (ou branch homologada pelo TL)
4. Inputs opcionais:


| Input          | Quando marcar `true`                                         |
| -------------- | ------------------------------------------------------------ |
| `skip_seed`    | Banco do job já tem dados do seed (reexecução rápida — raro) |
| `skip_migrate` | Schema já aplicado no mesmo runner (raro)                    |


1. **Run workflow** e aguardar o job **asaas-e2e** (verde) ou o job **asaas-e2e-not-configured** (aviso, se faltar secret).

### 4.3 Resultados esperados


| Situação                                   | Job que roda               | Resultado esperado                                                              |
| ------------------------------------------ | -------------------------- | ------------------------------------------------------------------------------- |
| Secret `ASAAS_API_KEY` **não** configurado | `asaas-e2e-not-configured` | Sucesso com **notice**: “Configure ASAAS_API_KEY…” — **não é falha de produto** |
| Secret configurado                         | `asaas-e2e`                | Migrate → seed → `e2e:asaas:evidence` → artefacto JSON                          |
| E2E OK                                     | `asaas-e2e`                | Step **Upload evidence JSON** com ficheiro; logs com **14/14** assertions OK    |


### 4.4 Baixar evidência do workflow

1. Na run concluída, secção **Artifacts**
2. Descarregar `asaas-e2e-evidence-<run_id>` (retenção **30 dias**)
3. Abrir o JSON e validar cada `"ok": true` nas assertions (ver checklist Sprint 1)
4. Anexar print + JSON ao ticket de QA — **não** fazer commit do JSON real no Git

Documentação complementar: [evidencias/README.md](./evidencias/README.md#ci-manual-github-actions--sprint-j).

---

## 5. Regressão automatizada (smoke CI local — opcional)

Antes de homolog pesada, o QA pode pedir ao dev ou rodar:

```bash
npm test              # ~223 testes unitários (sem Asaas real)
npm run portal:test   # testes do portal
npm run build
```

Com Postgres local:

```bash
npm run test:integration   # inclui bateria API + login portal
```

---

## 6. Cenários BDD (Gherkin) — para execução manual

**Convenções**

- **Dado** = pré-condição  
- **Quando** = ação  
- **Então** = resultado observável  
- Marcar cada cenário: ✅ Passou | ❌ Falhou | ⏭ N/A  
- Em falha: anexar print, URL, status HTTP (F12 → Network), `request_id` se existir

---

### Feature: Saúde da API

```gherkin
Funcionalidade: Endpoints de health da API
  Como QA
  Quero confirmar que a API está no ar
  Para saber se posso iniciar testes de portal

  Cenário: Liveness responde OK
    Dado que a API está em execução em "http://localhost:3333"
    Quando envio GET para "/health"
    Então o status HTTP é 200
    E o corpo JSON contém "status" com valor "ok"

  Cenário: Readiness com banco migrado
    Dado que executei "npm run migrate" com sucesso
    E a API está em execução
    Quando envio GET para "/health/ready"
    Então o status HTTP é 200
```

---

### Feature: Login do portal

```gherkin
Funcionalidade: Autenticação no portal web
  Como utilizador do escritório
  Quero entrar com e-mail, tenant e senha
  Para aceder às cobranças

  Contexto:
    Dado que o portal está em "http://localhost:5173"
    E o seed foi executado ("npm run seed:dev")

  Cenário: Login válido redireciona para área autenticada
    Quando abro "/login"
    E preencho e-mail "portal-seed@local.dev"
    E preencho tenant "escritorio-demo"
    E preencho senha "PortalSeedDev!ChangeMe1"
    E clico em entrar
    Então sou redirecionado para "/dashboard" ou outra rota autenticada
    E não vejo erro de rede no consola (F12)

  Cenário: Login inválido exibe erro
    Quando abro "/login"
    E preencho senha incorreta
    E clico em entrar
    Então permaneço em login ou vejo mensagem de erro
    E a API responde 401 ou 403 no POST "/v1/portal/auth/login"

  Cenário: Rota protegida sem sessão
    Dado que não estou autenticado
    Quando abro diretamente "/cobrancas"
    Então sou redirecionado para "/login"
```

---

### Feature: Listagem de cobranças

```gherkin
Funcionalidade: Lista de cobranças no portal
  Como operador do escritório
  Quero ver e paginar cobranças
  Para acompanhar recebíveis

  Background:
    Dado que estou autenticado no portal

  Cenário: Lista carrega sem erro
    Quando navego para "/cobrancas"
    Então vejo tabela de cobranças ou mensagem "Nenhuma cobrança"
    E o GET "/v1/portal/cobrancas" retorna 200 no F12

  Cenário: Carregar mais (paginação)
    Dado que existem mais de 50 cobranças no tenant de teste
    Quando clico em "Carregar mais" na lista
    Então novos itens aparecem na tabela
    E o pedido usa parâmetro "cursor" na query string
```

---

### Feature: Nova cobrança

```gherkin
Funcionalidade: Criação de cobrança pelo portal
  Como operador
  Quero criar uma cobrança
  Para emitir boleto posteriormente

  Background:
    Dado que estou autenticado
    E o escritório tem billing link ativo (sem aviso amarelo crítico em "/escritorio")

  Cenário: Criar cobrança com sucesso
    Quando navego para "/cobrancas/nova"
    E preencho referência única "QA-REF-{timestamp}"
    E preencho valor "150.00"
    E preencho data de vencimento futura
    E confirmo a criação
    Então a API responde 201 no POST "/v1/portal/cobrancas"
    E a cobrança aparece em "/cobrancas" com status inicial (ex.: rascunho)

  Cenário: Nova cobrança a partir do cliente
    Dado que existe um cliente na lista "/clientes"
    Quando abro o detalhe do cliente
    E clico em nova cobrança para esse cliente
    Então o formulário abre com cliente pré-selecionado
```

---

### Feature: Editar cobrança (Sprint F)

```gherkin
Funcionalidade: Retificação de cobrança
  Como operador
  Quero alterar valor e vencimento
  Sem duplicar cobrança

  Background:
    Dado que estou autenticado
    E existe cobrança em status editável (não "paga" nem "cancelada")

  Cenário: Editar valor e vencimento
    Quando abro "/cobrancas/{id}/editar"
    E altero o valor para "200.00"
    E altero a data de vencimento
    E salvo
    Então a API responde 200 no PATCH "/v1/portal/cobrancas/{id}"
    E o detalhe "/cobrancas/{id}" mostra os novos dados

  Cenário: Cobrança paga não permite edição
    Dado que a cobrança está com status "paga"
    Quando tento abrir "/cobrancas/{id}/editar"
    Então a rota de edição não está disponível OU a API retorna erro de negócio ao PATCH
```

---

### Feature: Clientes

```gherkin
Funcionalidade: Cadastro de clientes no portal
  Como operador
  Quero gerir clientes
  Para associar cobranças

  Background:
    Dado que estou autenticado

  Cenário: Listar clientes
    Quando navego para "/clientes"
    Então vejo lista ou estado vazio
    E GET "/v1/portal/clientes" retorna 200

  Cenário: Criar cliente
    Quando navego para "/clientes/novo"
    E preencho nome e e-mail válidos
    E confirmo
    Então POST "/v1/portal/clientes" retorna 201
    E o cliente aparece na lista

  Cenário: Editar cliente sem alterar documento
    Dado que existe cliente "Cliente QA"
    Quando abro "/clientes/{id}/editar"
    E altero apenas o nome
    E salvo
    Então PATCH "/v1/portal/clientes/{id}" retorna 200
```

---

### Feature: Configurações do escritório (admin)

```gherkin
Funcionalidade: Configurações gateway e régua
  Como admin do escritório
  Quero configurar integrações
  Para cobrança e notificações

  Background:
    Dado que estou autenticado como admin_escritorio

  Cenário: Acesso à página de configurações
    Quando navego para "/configuracoes"
    Então vejo abas Gateway, Régua e Templates
    E GET "/v1/portal/escritorio/config" retorna 200

  Cenário: Utilizador sem perfil admin não acessa
    Dado que estou autenticado com papel "operador" apenas
    Quando tento abrir "/configuracoes"
    Então recebo 403 na API ou a UI bloqueia o acesso
```

---

### Feature: Escritório e assinatura SaaS

```gherkin
Funcionalidade: Resumo do escritório e billing
  Como admin
  Quero ver estado do plano e billing link
  Para saber se posso emitir cobranças

  Background:
    Dado que estou autenticado

  Cenário: Página escritório exibe tenant e link
    Quando navego para "/escritorio"
    Então vejo informação do tenant
    E vejo estado do billing link (ativo / pendente / aviso)
```

---

### Feature: Homolog Asaas — workflow GitHub (Sprint J)

```gherkin
Funcionalidade: Pipeline manual Asaas E2E no GitHub
  Como QA
  Quero executar homologação repetível
  Para validar integração sandbox sem expor chaves no repo

  Cenário: Workflow sem secret apenas avisa
    Dado que o secret "ASAAS_API_KEY" NÃO está configurado no repositório
    Quando disparo "Asaas E2E (manual)" na branch "main"
    Então o job "asaas-e2e-not-configured" termina com sucesso
    E o log contém aviso para configurar ASAAS_API_KEY
    E nenhum artefacto JSON é gerado

  Cenário: Workflow com secret gera evidência
    Dado que o Tech Lead configurou o secret "ASAAS_API_KEY" (sandbox)
    Quando disparo "Asaas E2E (manual)" com skip_seed false e skip_migrate false
    Então o job "asaas-e2e" termina com sucesso
    E existe artefacto "asaas-e2e-evidence-{run_id}"
    E no JSON todas as assertions listadas no checklist Sprint 1 têm "ok": true
    E o terminal/log indica "14/14" assertions OK

  Cenário: JSON de evidência não contém segredos
    Dado que descarreguei o artefacto da run
    Quando abro o ficheiro JSON
    Então não encontro substring "$aact_" nem chaves API em texto claro
    E "environment.databaseUrl" está mascarada
```

---

### Feature: Homolog Asaas — execução local

```gherkin
Funcionalidade: Script E2E local com Asaas Sandbox
  Como QA
  Quero reproduzir o mesmo fluxo do CI na máquina local
  Para depurar falhas

  Cenário: Script falha sem DATABASE_URL
    Dado que DATABASE_URL está vazio
    Quando executo "npm run e2e:asaas:evidence"
    Então o processo termina com código 1
    E a mensagem menciona "DATABASE_URL ausente"

  Cenário: Script completo com ambiente válido
    Dado que ".env" tem DATABASE_URL, ASAAS_API_KEY, ENCRYPTION_KEY e WEBHOOK_INBOX_SECRET
    E executei migrate e seed:dev
    Quando executo "npm run e2e:asaas:evidence"
    Então o processo termina com código 0
    E é criado ficheiro em "docs/evidencias/asaas-e2e-*.json"
    E o terminal mostra 14 assertions OK
    Quando preencho o checklist em "docs/evidencias/SPRINT1_ACEITE_CHECKLIST.md"
    Então marco cada critério com evidência (print ou caminho do JSON fora do Git)
```

---

### Feature: Inbox webhook (API — Postman opcional)

```gherkin
Funcionalidade: Idempotência de webhooks
  Como QA técnico
  Quero validar que webhook duplicado não duplica eventos
  Para garantir consistência financeira

  Cenário: Webhook duplicado deduplicado
    Dado que tenho header "x-tenant-id" com UUID do tenant demo "00000000-0000-4000-8000-000000000001"
    E header "x-webhook-secret" igual ao WEBHOOK_INBOX_SECRET do ambiente
    E header "x-external-event-id" único "qa-event-001"
    Quando envio POST "/v1/inbox/webhooks" com payload Asaas PAYMENT_RECEIVED válido
    E reenvio o mesmo POST com o mesmo "x-external-event-id"
    Então a segunda resposta indica deduplicação (sem novo evento de cobrança duplicado)
```

Collection Postman: `postman/Asaas_Sandbox_E2E.postman_collection.json`.

---

## 7. Matriz rápida — o que testar onde


| Área                   | Local (portal) | Playwright `e2e:playwright` | Local (script E2E) | GitHub workflow |
| ---------------------- | -------------- | --------------------------- | ------------------ | --------------- |
| Login / navegação      | ✅              | ✅                           | —                  | —               |
| CRUD cobrança/cliente  | ✅              | ✅                           | parcial            | —               |
| Paginação cobranças    | ✅              | ✅ (após `seed:dev`)         | —                  | —               |
| Editar cobrança        | ✅              | ✅                           | —                  | —               |
| Configurações admin    | ✅              | ✅                           | —                  | —               |
| Emissão real Asaas     | opcional*      | skip* (`RUN_ASAAS_E2E=1`)   | ✅                  | ✅               |
| Webhook + idempotência | Postman        | ✅                           | ✅                  | ✅               |
| 14 assertions Sprint 1 | checklist      | skip*                        | ✅                  | ✅ (artefacto)   |


 Emissão real no portal exige API + Redis + worker; para QA júnior, priorizar **workflow** ou **script** `e2e:asaas:evidence`.

---

## 8. Registro de defeitos (template)


| ID     | Cenário BDD | Passos | Esperado | Obtido | Evidência       | Severidade       |
| ------ | ----------- | ------ | -------- | ------ | --------------- | ---------------- |
| QA-001 |             |        |          |        | print / run URL | Alta/Média/Baixa |


**URL da run GitHub (exemplo):**  
`https://github.com/rvbbarreto-bot/cobranca-saas-api/actions/runs/<run_id>`

---

## 9. Referências para o time


| Documento                                                                          | Uso                               |
| ---------------------------------------------------------------------------------- | --------------------------------- |
| [PORTAL_WEB.md](./PORTAL_WEB.md)                                                   | Rotas SPA e dev                   |
| [PORTAL_WEB_TEST_BATTERY.md](./PORTAL_WEB_TEST_BATTERY.md)                         | Bateria manual resumida           |
| [ASAAS_SANDBOX_E2E.md](./ASAAS_SANDBOX_E2E.md)                                     | Fluxo Asaas detalhado             |
| [evidencias/SPRINT1_ACEITE_CHECKLIST.md](./evidencias/SPRINT1_ACEITE_CHECKLIST.md) | Aceite PO                         |
| [RUNBOOK_AUTH_PRODUCAO.md](./RUNBOOK_AUTH_PRODUCAO.md)                             | Auth em produção (não usar mocks) |
| [INBOX_WEBHOOK_IDEMPOTENCIA.md](./INBOX_WEBHOOK_IDEMPOTENCIA.md)                   | Headers webhook                   |


---

## 10. Aprovações


| Papel     | Nome | Data | Assinatura |
| --------- | ---- | ---- | ---------- |
| PO        |      |      |            |
| Tech Lead |      |      |            |
| QA Lead   |      |      |            |


---

*Documento emitido por PO + Tech Lead para homologação Maio/2026. Dúvidas de ambiente: canal do projeto com Tech Lead antes de testar produção.*