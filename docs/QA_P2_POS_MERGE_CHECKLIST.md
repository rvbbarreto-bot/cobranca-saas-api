# QA — Checklist pós-merge P2 (#24)

**Base:** `main` após merge do PR #24 · **Migração obrigatória:** `027_portal_cliente_endereco.sql`

---

## 1. Preparação do ambiente

```bash
git checkout main && git pull origin main
npm ci
npm run migrate
npm run seed:dev
npm run build
npm test
npm run portal:test
```

Portal: `npm run portal:dev` (API `:3333`, Vite `:5173`)  
Login seed: `portal-seed@local.dev` · tenant `escritorio-demo`

---

## 2. Regressão Asaas (não quebrar homologado)

| # | Cenário | Esperado |
|---|---------|----------|
| R1 | Login portal | 200, lista cobranças carrega |
| R2 | Nova cobrança **sem** exigir endereço (Asaas) | 201, emissão segue fluxo habitual |
| R3 | Editar cobrança em status editável | PATCH OK |
| R4 | Reprocessar `erro_emissao` (se houver título) | Botão reprocessa |

---

## 3. Cliente + endereço (P2.2)

| # | Cenário | Esperado |
|---|---------|----------|
| C1 | Cadastrar cliente **com** endereço completo | 201, GET retorna `endereco` |
| C2 | Cadastrar cliente **sem** endereço | 201 (permitido no cadastro) |
| C3 | PATCH cliente incluindo `endereco` | 200, campos persistidos |

---

## 4. Cobrança Inter / Cora / C6 (endereço obrigatório)

Pré-requisito: escritório com `gateway_provider` = `inter` (ou cora/c6) e credenciais válidas.

| # | Cenário | Esperado |
|---|---------|----------|
| G1 | Nova cobrança com cliente **sem** endereço | **422** `validation_error` em `portal_cliente_id` |
| G2 | Nova cobrança com cliente **com** endereço | 201, job de emissão enfileirado |
| G3 | Worker emissão (se Inter OAuth OK) | Pagador com CEP/endereço reais (não São Paulo fake) |

Com Asaas no escritório, G1/G2 não se aplicam (endereço não obrigatório na API).

---

## 5. Portal UX (Onda C MVP)

| # | Cenário | Esperado |
|---|---------|----------|
| U1 | Lista → **Histórico** | Abre detalhe em `#timeline` |
| U2 | Lista → **Enviar** / **Cobrar** | Abre detalhe em `#enviar` |
| U3 | Lista → **Ver PDF** em rascunho | Link desabilitado |
| U4 | Detalhe com emissão + telefone + `whatsapp_opt_in` | Botão WhatsApp ativo |
| U5 | Detalhe sem opt-in | Mensagem “sem opt-in” |

---

## 6. Configuração gateway (P2.4)

| # | Cenário | Esperado |
|---|---------|----------|
| K1 | PATCH credenciais Inter com PEM inválido | **422** `gateway_credentials_invalid` |
| K2 | PATCH só `client_id` (resto já salvo) | 200, merge + validação do par PEM |

---

## 7. Smoke Inter (opcional — máquina com certificado)

```powershell
$env:RUN_INTER_SANDBOX="1"
$env:INTER_CLIENT_ID="..."
$env:INTER_CLIENT_SECRET="..."
$env:INTER_CERT_PATH="C:\QA\inter-sandbox\Inter API_Certificado.crt"
$env:INTER_KEY_PATH="C:\QA\inter-sandbox\Inter API_Chave.key"
npm run gateway:smoke:inter
```

Esperado: `PEM: OK` e `OAuth Inter sandbox: OK` (ou erro TLS documentado para o Inter).

---

## 8. Evidências

Registrar em `docs/evidencias/`:

- Print lista/detalhe (histórico, enviar, PDF)
- Resposta 422 sem endereço (JSON sanitizado)
- Resultado smoke Inter (sem secrets)

---

## 9. Próximo desenvolvimento (após QA verde)

1. **P2.1** PDF Inter real (`feat/p2-inter-pdf`) — Onda B  
2. Envio rastreado (API + status `enviada`) — evolução P2.6  
3. Homolog certificado com Banco Inter (desbloqueio externo)
