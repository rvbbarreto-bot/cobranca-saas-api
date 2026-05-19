# Bateria de testes — Portal web (validação de versão)

Automático + manual. Executar antes de marcar entrega da **primeira fase** (MVP gelado em `MVP_ESCOPO_CONGELADO.md`).

**Automático na API (integração Postgres):** na raiz do repo, `npm run test:integration` inclui a bateria funcional (`tests/functional/api-battery.integration.test.ts`), login portal real (`sprint-a-portal-login`) e provision (`sprint-a-provision`), além de health/webhook/cross-tenant.

## Automático (CI / local)

Na raiz `cobranca-saas-api`:

```bash
cd apps/portal-web && npm install && npm test
```

Ou a partir da raiz:

```bash
npm run portal:test
```

**Esperado:** todos os testes Vitest em `apps/portal-web/src/**/*.test.*` a passar.

## Manual — ambiente

| # | Passo | Critério de sucesso |
|---|--------|----------------------|
| 1 | `npm run migrate` + `npm run seed:dev` (API) | Utilizador seed com `password_hash`. |
| 2 | `npm run dev` (API, porta 3333) | `GET http://localhost:3333/health` → `200` JSON `status: ok`. |
| 3 | `npm run portal:dev` | Abre `http://localhost:5173` sem erro de build. |

## Manual — fluxo portal

| # | Passo | Critério |
|---|--------|-----------|
| 4 | Abrir `/` ou `/login` | Formulário com e-mail, tenant, senha. |
| 5 | Login com credenciais seed | Redireciona para `/dashboard` (ou fluxo equivalente); sem erro de rede no F12. |
| 6 | Navegar **Cobranças** | Tabela ou “Nenhuma cobrança”; se `billing_link_status` missing, aviso amarelo da API. |
| 6b | **Notas fiscais** | Lista ou vazio; `GET /v1/portal/notas-fiscais` sem token deve 401 na API. |
| 6c | **Clientes** (se papel seed for admin/operador) | Lista; opcional: criar cliente e ver detalhe. |
| 6d | **Nova cobrança** (`/cobrancas/nova`) | Referência + valor + vencimento → `201`; lista em `/cobrancas` atualizada. |
| 6e | **Cliente → cobranças** | No detalhe do cliente, tabela de cobranças ou vazio; botão “Nova cobrança” pré-preenche cliente. |
| 6f | **Relatórios** | `/relatorios` — CSV descarrega quando há cobranças e billing link OK. |
| 6g | **Escritório** | `/escritorio` — mostra tenant e estado do billing link. |
| 7 | **Sair** | Volta a `/login`; recarregar rota protegida redireciona para login. |
| 8 | Login inválido | Mensagem de erro visível (401/403 da API). |

## Manual — build de produção do front

```bash
npm run portal:build
```

**Esperado:** `apps/portal-web/dist/` gerado sem erros TypeScript.

## Regressão API (opcional)

Com a API a correr:

```bash
npm run test:functional
```

Garante que a API continua coerente com o contrato usado pelo portal.
