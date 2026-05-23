# Resultado — Postman Inter Homolog (smoke)

**Data:** 2026-05-22  
**Executor:** Tech Lead (Newman CLI)  
**API:** `http://localhost:3334` (código atual + `npm run migrate`)  
**Collection:** `postman/Inter_Gateway_Homolog.postman_collection.json`

## Resumo

| Métrica | Valor |
|---------|--------|
| Requests | 10 |
| Assertions | 24 |
| Falhas | 0 |
| Duração | ~1,6 s |

## Cenários cobertos (smoke)

| ID | Resultado |
|----|-----------|
| Ambiente health/ready | Pass |
| Login + admin_escritorio | Pass |
| INT-01 providers Inter | Pass |
| INT-02 schema 4 campos | Pass |
| INT-03 PATCH gateway Inter | Pass (PEM placeholder — só persiste credenciais) |
| INT-04 config mascarada | Pass |
| INT-07 history array | Pass |

## Pendente para QA (suite completa pasta 3)

- Colar **certificado** e **chave privada** PEM reais no environment `.local`
- Definir `pemConfigured=true`
- API com **Redis** ativo para emissão (`REDIS_URL` + worker)
- Repetir: `POSTMAN_BASE_URL=http://localhost:3334 npm run postman:inter:homolog`

## Atenção — Docker :3333

O container `cobranca-saas-api-api-1` na porta **3333** estava **sem** rotas `/gateway/*` e sem migration 025. Para homolog Inter use API **build atual** (ex.: `npm run dev` na porta 3334) ou `docker compose up -d --build api` após `npm run migrate`.

Relatório JSON completo (gitignored): `postman-inter-homolog-report.json`
