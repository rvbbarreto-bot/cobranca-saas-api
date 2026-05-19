# PostgreSQL e `.env` — API Cobrança (`cobranca-saas-api`)

Fonte oficial do pacote: `Projeto_CobrancaBoleto\Projeto\cobranca-saas-api`.  
Use um **banco PostgreSQL novo e separado** do banco do projeto de emissão de NF, com outro `database` (e, se quiser, outro usuário).

---

## 1. Criar o banco (novo, isolado do NF)

### 1.1 Instância

- Instale PostgreSQL 14+ (local, Docker ou serviço gerenciado).
- Anote **host**, **porta** (geralmente `5432`), **nome do banco** que você vai criar, **usuário** e **senha**.

### 1.2 Usuário e database (exemplo no `psql` como superuser)

```sql
-- Usuário só para esta API (ajuste nome/senha)
CREATE USER cobranca_app WITH PASSWORD 'sua_senha_forte';

CREATE DATABASE cobranca_saas OWNER cobranca_app;

\c cobranca_saas

-- Extensões usadas nas migrações (pgcrypto em 001/004)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

GRANT ALL PRIVILEGES ON DATABASE cobranca_saas TO cobranca_app;
GRANT ALL ON SCHEMA public TO cobranca_app;
```

Se o owner do database já for `cobranca_app`, o `CREATE DATABASE ... OWNER` basta; o app precisa de `CREATE` em `public` para tabelas criadas pelas migrações.

### 1.3 String `DATABASE_URL`

Formato:

`postgres://USUARIO:SENHA@HOST:PORTA/NOME_DO_BANCO`

Exemplo:

`postgres://cobranca_app:sua_senha_forte@localhost:5432/cobranca_saas`

- Senhas com caracteres especiais devem ser **URL-encoded** (ex.: `@` → `%40`).
- Em produção, prefira TLS (`sslmode=require` na query string, se o provedor exigir).

---

## 2. Configurar o `.env`

### 2.1 Criar o arquivo

Na pasta `cobranca-saas-api`:

1. Copie `.env.example` para `.env`.
2. Preencha no mínimo as variáveis abaixo.

### 2.2 Obrigatórias

| Variável | Descrição |
|----------|-----------|
| `DATABASE_URL` | URL de conexão do PostgreSQL **novo** (seção 1.3). |
| `JWT_SECRET` | Segredo longo e aleatório para assinar JWT (não commite o `.env`). |

### 2.3 Recomendadas / operação

| Variável | Descrição |
|----------|-----------|
| `PORT` | Porta HTTP (padrão no exemplo: `3333`). |
| `PG_POOL_MAX` | Tamanho do pool (ex.: `20`). |
| `WEBHOOK_INBOX_SECRET` | Segredo compartilhado com o n8n/provedor ao postar em `/v1/inbox/webhooks` (se usar inbox). |
| `NODE_ENV` | `development` ou `production`. |
| `CORS_ORIGIN` | Em produção, URL exata do front (evita `*`). |

### 2.4 Job `npm run job:webhook-inbox`

| Variável | Descrição |
|----------|-----------|
| `WEBHOOK_PROCESS_TENANT_IDS` | Lista de UUIDs de `public.tenants`, separados por vírgula; se vazio, processa todos os tenants `active`. |
| `WEBHOOK_PROCESS_LIMIT` | Máximo de eventos por tenant por execução (default `25`, máx. `100`). |

---

## 3. Aplicar migrações

Com o `.env` na raiz do pacote e `DATABASE_URL` apontando para o **novo** banco:

```bash
npm install
npm run migrate
```

O script `scripts/migrate.ts` executa **todos** os arquivos `db/migrations/*.sql` em **ordem lexicográfica**:

- **`000_automacao_stub_cobranca_saas.sql`** — em banco vazio, cria um `automacao` mínimo para as migrações 002–007 e a view do portal não falharem. Se você já tiver o schema `automacao` real (mesmo servidor que o NF), os `CREATE IF NOT EXISTS` não sobrescrevem nada.
- Em seguida: `001` … `010` (billing, portal, cliente, webhook inbox, etc.).

Se `migrate` falhar, leia a mensagem do PostgreSQL (permissão, extensão `pgcrypto`, URL incorreta).

---

## 4. Validar

```bash
npm run build
npm test
npm run seed:dev
npm run test:integration
# ou somente a bateria funcional (também executa seed internamente no beforeAll):
npm run test:functional
```

Com `DATABASE_URL` válido, os testes de integração **não** são ignorados; eles assumem os tenants seed `demo` e `other` criados pela migração `001`. O `npm run seed:dev` cria usuario portal + escritorio `escritorio-demo` + `portal.billing_tenant_link` para o tenant `demo` (idempotente).

Producao: `NODE_ENV=production` desliga rotas mock por padrao, exige `WEBHOOK_INBOX_SECRET` para `POST /v1/inbox/webhooks`, e emite avisos no boot se configuracao estiver fraca — ver [docs/API_CONTRATO_E_SMOKE.md](./docs/API_CONTRATO_E_SMOKE.md). Passo a passo completo de endurecimento e checklist de release: [docs/PRODUCAO_ENDURECIMENTO_PASSO_A_PASSO.md](./docs/PRODUCAO_ENDURECIMENTO_PASSO_A_PASSO.md); validacao: `npm run check:prod-env -- --strict`.

---

## 5. Portal ↔ billing (`automacao` stub ou real)

- `portal.membership.tenant_id` e `portal.cliente.tenant_id` são **texto**, alinhados ao id do escritório em `automacao.tenants` (no stub: `id` serial → texto `'1'`, `'2'`, …).
- `public.tenants` (UUID) é o tenant da API de cobrança; a ponte é `portal.billing_tenant_link`.

Exemplo após criar uma linha em `automacao.tenants` com `id = 1` e usar o tenant demo da API (`001`):

```sql
INSERT INTO portal.billing_tenant_link (automacao_tenant_id, public_tenant_id)
VALUES ('1', '00000000-0000-4000-8000-000000000001'::uuid)
ON CONFLICT (automacao_tenant_id) DO NOTHING;
```

Ajuste `automacao_tenant_id` e o UUID conforme seu ambiente.

---

## 6. Dois cenários em uma linha

| Cenário | Uso do `000` |
|--------|----------------|
| Banco **só cobrança**, novo | `000` cria stub; `004` cria portal + view sobre tabelas vazias. |
| Banco **já tem** n8n / `automacao` completo | `000` não altera tabelas existentes (`IF NOT EXISTS`). |

O **Projeto_EmissaoNF** pode permanecer com outro database; evite apontar a mesma `DATABASE_URL` para dois apps diferentes sem alinhamento explícito de schema e deploy.
