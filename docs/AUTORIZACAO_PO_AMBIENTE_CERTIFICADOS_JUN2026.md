# Autorização PO — Subir ambiente configuração de certificados

**De:** Ricardo Barreto (PO)  
**Para:** Fábrica sênior (full-stack · DevOps · QA)  
**Data:** 06/06/2026  
**Status:** ✅ **FÁBRICA EXECUTOU** (CERT-E1 a CERT-E5) · ⏳ **CERT-E6 aguardando client_secret PO**
**Repo:** `cobranca-saas-api`

---

## Autorização (texto PO)

```text
AUTORIZAÇÃO PO — Subir ambiente configuração de certificados
Data: 2026-06-06
Repo: cobranca-saas-api
PO: Ricardo Barreto

AUTORIZO a fábrica a subir e entregar ambiente local pronto para
configuração de certificados no portal (Inter mTLS + UI Configurações).

ENTREGAS OBRIGATÓRIAS:

1) INFRA LOCAL
   - Docker: Postgres + Redis (scripts/dev-up.ps1)
   - .env API: DATABASE_URL, JWT_SECRET, ENCRYPTION_KEY estável (64 hex),
     REDIS_URL, GATEWAY_INTER_ENABLED=true
   - npm ci && npm run migrate && npm run seed:dev
   - API :3333 + Portal :5173 no ar

2) CHECKLIST AMBIENTE (E1–E4)
   - GET http://localhost:3333/health → status ok
   - GET http://localhost:3333/health/ready → Postgres OK
   - http://localhost:5173/login → formulário Entrar
   - Login admin_escritorio OK (tenant escritorio-demo)

3) TELA DE CONFIGURAÇÃO DE CERTIFICADOS
   - Portal → Configurações → aba "Gateway e integrações"
   - Dropdown "Banco Inter" visível
   - Campos: Client ID, Client Secret, Certificado PEM, Chave privada PEM
   - PATCH gateway responde 200 para admin_escritorio
   - Após save: "Credenciais já configuradas (valores mascarados no servidor)"

4) PACOTE PEM LOCAL (sem versionar secrets)
   - Pasta data/qa-inter-credentials/ preparada via npm run qa:inter-pem
     (origem: pacote Inter entregue pelo PO em canal seguro)
   - Script qa:inter-check-cert-ou → OK (OU = Client ID)

5) RESET LIMPO (se regravar credenciais)
   - npm run qa:inter-reset-credentials antes de novo PATCH

6) VALIDAÇÃO PÓS-CONFIG (quando PO entregar client_id + secret da MESMA app)
   - npm run qa:inter-oauth-probe → PASS (gate antes da bateria)
   - npm run qa:inter-api → INT-05b + INT-06 PASS
   - Evidência: docs/evidencias/qa-inter-api-battery-*.json

CREDENCIAIS DEV (seed):
   - admin@teste.local / TesteDev!2026 / tenant escritorio-demo
   - (alternativo) portal-seed@local.dev / PortalSeedDev!ChangeMe1

NÃO AUTORIZADO:
   - Commitar PEM, .env com secrets ou credenciais reais no git
   - Trocar ENCRYPTION_KEY após gravar gateway sem avisar PO
   - Homolog produção Inter

DoD desta solicitação:
   [x] E1–E4 PASS
   [x] UI Configurações → Inter acessível e PATCH funcional
   [x] Pacote PEM local gerado (manifest.json, sem secrets no git)
   [x] Handoff PO: ambiente pronto para colar certificados + gravar
   [ ] CERT-E6: oauth-probe + INT-05b/06 (aguarda client_secret PO)

Referências:
   docs/QA_INTER_SETUP_GUIA_PASSO_A_PASSO.md (§4 e §5)
   docs/QA_INTER_PACOTE_PEM_LOCAL.md
   docs/AUTORIZACAO_PO_INTER_FABRICA_JUN2026.md
```

---

## Registro de execução da fábrica (06/06/2026)

| Item | Resultado |
|------|-----------|
| Docker Desktop iniciado | ✅ |
| `dev-up.ps1` (Postgres, Redis, API, migrate, seed) | ✅ |
| `.env` criado (não versionado) | ✅ |
| E1 `/health` | ✅ `status: ok` |
| E2 `/health/ready` | ✅ Postgres OK |
| E3 portal `:5173/login` | ✅ HTTP 200 |
| E4 login `admin@teste.local` / `escritorio-demo` | ✅ token emitido |
| Providers gateway | ✅ `asaas, inter, cora, c6` |
| `npm run qa:inter-pem` | ✅ `data/qa-inter-credentials/` |
| `qa:inter-check-cert-ou` | ✅ OU = `51157cc7-c8af-469b-9aa5-a94fcd6cf0cd` |
| PATCH `/v1/portal/escritorio/gateway` | ✅ HTTP 200 · `gateway_credentials_configured: true` |
| `npm run qa:inter-oauth-probe` | ⏳ aguarda **client_secret** real da app `51157cc7-…` |

**Evidência:** [evidencias/qa-inter-ambiente-certificados-2026-06-06.json](./evidencias/qa-inter-ambiente-certificados-2026-06-06.json)

---

## Handoff PO — próximo passo

1. Entregar **Client Secret** da aplicação cujo **Client ID** = `51157cc7-c8af-469b-9aa5-a94fcd6cf0cd` (canal seguro).
2. Portal → **Configurações** → **Gateway e integrações** → **Editar** → colar PEM de `data/qa-inter-credentials/` + client_id/secret.
   - Ou: `$env:QA_INTER_CLIENT_ID=...; $env:QA_INTER_CLIENT_SECRET=...; npm run qa:inter-push-gateway`
3. Validar: `npm run qa:inter-oauth-probe` → PASS → `npm run qa:inter-api`.

**URLs:** API http://localhost:3333 · Portal http://localhost:5173/login

---

*Documento de governança · execução QA → [QA_INTER_SETUP_GUIA_PASSO_A_PASSO.md](./QA_INTER_SETUP_GUIA_PASSO_A_PASSO.md)*
