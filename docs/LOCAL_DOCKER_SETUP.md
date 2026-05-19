# Ambiente local — Docker Compose (`cobranca-saas-api`)

## Pré-requisitos

1. Docker Desktop em execução.
2. Copiar `.env.example` → `.env` e preencher secrets (`JWT_SECRET`, `WEBHOOK_INBOX_SECRET`, `ENCRYPTION_KEY`).
3. **`DB_PASSWORD`** deve ser **igual** à senha já usada pelo container `cobranca-saas-api-postgres-1` (variável `POSTGRES_PASSWORD` do compose). Não invente senha nova em volume já inicializado.

## Banco oficial (único permitido)

| Item | Valor |
|------|--------|
| Projeto Compose | `cobranca-saas-api` |
| Container | `cobranca-saas-api-postgres-1` |
| Database | `cobranca_saas` |
| Usuário | `app` |
| Host **dentro** da rede Docker | `postgres` (service name) |
| `DATABASE_URL` (API no Compose) | `postgres://app:***@postgres:5432/cobranca_saas` |

**Não usar:** `evo_postgres`, `barbearia-postgres`, `projeto_emissaonf-postgres-1`.

## Subir stack

```powershell
cd "...\Projeto\cobranca-saas-api"
docker compose config          # deve passar sem erro
docker compose up -d postgres redis
docker compose run --rm migrate   # ver nota abaixo
docker compose up -d api
```

O script `npm run migrate` usa a tabela `public.schema_migrations` (idempotente). Bancos legados recebem bootstrap automático.

Se `migrate` falhar por outro motivo, suba a API temporariamente com:

```powershell
docker compose up -d --no-deps api
```

## Healthcheck

- `GET http://localhost:3333/health` — liveness
- `GET http://localhost:3333/health/ready` — readiness + checagens de DB

## Backup (antes de migrate)

```powershell
$STAMP = Get-Date -Format "yyyyMMdd_HHmmss"
docker exec cobranca-saas-api-postgres-1 pg_dump -U app -d cobranca_saas -F c -f "/tmp/cobranca_saas_$STAMP.dump"
docker cp "cobranca-saas-api-postgres-1:/tmp/cobranca_saas_$STAMP.dump" "C:\Projetos\backup-cobranca-saas\cobranca_saas_$STAMP.dump"
```

## Portal web (fora do Compose)

```powershell
npm run portal:dev
```

Frontend: `http://localhost:5173` — configure `PORTAL_CLIENT_URL` e `CORS_ORIGIN` no `.env`.

## Testes no host

Postgres/Redis **não** publicam porta no host por padrão. Para `npm run dev` ou Vitest no Windows, use:

- `docker compose run --rm migrate npm run check:db`, ou
- `docker compose run --rm migrate npm run check:db` (rede interna), ou publique `5432` no service `postgres` se precisar do host.

## Comandos proibidos

`docker compose down -v`, `docker volume prune`, `prisma migrate reset`, `DROP DATABASE`, etc.
