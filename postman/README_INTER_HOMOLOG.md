# Postman — Homologação Banco Inter (pacote QA)

**Tech Lead:** collection com testes automatizados (Newman) e matriz **INT-xx**.  
**QA:** importar no Postman ou correr `npm run postman:inter:smoke`.

---

## 1. Ficheiros do pacote

| Ficheiro | Commit? | Uso |
|----------|---------|-----|
| `Inter_Gateway_Homolog.postman_collection.json` | Sim | Collection principal (testes INT-01…09) |
| `Inter_Gateway_Homolog.postman_environment.json` | Sim | Template vazio (dev seed) |
| `Inter_Gateway_Homolog.local.postman_environment.example.json` | Sim | Modelo para criar o `.local` |
| `Inter_Gateway_Homolog.local.postman_environment.json` | **Não** | Secrets reais (gitignored) |
| `../Projeto_CobrancaBoleto/postman/Inter_Sandbox.*` | Sim | Teste **direto** na API Inter (mTLS no Postman) |

---

## 2. Setup QA (primeira vez)

### 2.1 API e portal no ar

```powershell
npm run dev:up          # ou scripts/dev-up.ps1
npm run dev             # terminal 1 — :3333
npm run portal:dev      # terminal 2 — :5173 (opcional para UI)
```

Confirmar: http://localhost:3333/health → `status: ok`

### 2.2 Environment local (secrets)

1. Copiar `Inter_Gateway_Homolog.local.postman_environment.example.json`  
   → `Inter_Gateway_Homolog.local.postman_environment.json`
2. Preencher:

| Variável | Valor |
|----------|--------|
| `interClientId` | UUID do portal Inter |
| `interClientSecret` | Secret do portal Inter |
| `interCertificatePem` | Conteúdo PEM do `.crt` (quebras de linha reais) |
| `interPrivateKeyPem` | Conteúdo PEM do `.key` |
| `pemConfigured` | `true` quando PEM forem válidos |

**Nunca** commitar o ficheiro `.local`.

### 2.3 Import no Postman (GUI)

1. **Import** → collection + environment **Local**  
2. Dropdown superior direito → environment **Inter Gateway Homolog — Local**  
3. **Collection Runner** → ordem das pastas 0 → 1 → 2 → (aguardar 5s) → 3  

---

## 3. Execução automatizada (Newman)

**Pré-requisitos Tech Lead (uma vez por máquina):**

```bash
npm ci
npm run migrate                    # 025 + 026 (gateway universal)
# API com código atual (não só Docker antigo em :3333):
$env:PORT="3334"
$env:REDIS_URL="redis://127.0.0.1:6379"   # ou Redis do compose mapeado no host
npm run dev
```

**Credenciais locais (gitignored):**

```powershell
$env:INTER_CLIENT_ID="<uuid>"
$env:INTER_CLIENT_SECRET="<secret>"
# Opcional PEM para pasta 3:
# $env:INTER_CERTIFICATE_PEM=Get-Content -Raw .\certs\Inter_API_Certificado.crt
# $env:INTER_PRIVATE_KEY_PEM=Get-Content -Raw .\certs\Inter_API_Chave.key
npm run postman:inter:setup-local
```

**Correr testes:**

```bash
$env:POSTMAN_BASE_URL="http://localhost:3334"
npm run postman:inter:smoke    # pastas 0–2 — 24 assertions (validado 2026-05-22)
npm run postman:inter:homolog  # suite completa; pasta 3 exige pemConfigured=true
```

Relatório JSON (gitignored): `docs/evidencias/postman-inter-homolog-report.json`  
Evidência smoke: [docs/evidencias/postman-inter-homolog-SMOKE-RESULT.md](../docs/evidencias/postman-inter-homolog-SMOKE-RESULT.md)

### API Docker na porta 3333

Se `GET .../gateway/providers` retornar **400** `tenant_resolution_failed`, o container está **desatualizado** (sem Sprint L/M). Solução: `docker compose up -d --build api` após `npm run migrate`, ou usar `npm run dev` em **3334** como acima.

Variáveis de ambiente alternativas (sem ficheiro `.local`):

```powershell
$env:INTER_CLIENT_ID="..."
$env:INTER_CLIENT_SECRET="..."
npm run postman:inter:smoke
```

---

## 4. O que cada pasta valida

| Pasta | Cenários | Pré-requisito |
|-------|----------|---------------|
| **0 — Health** | API no ar | `npm run dev` |
| **1 — Auth** | Login seed + `admin_escritorio` | Seed dev |
| **2 — Gateway** | INT-01, 02, 03, 04, 07 | Client ID/Secret no environment |
| **3 — Cobrança** | INT-05, 06 | PEM válidos + `pemConfigured=true` + Redis |
| **4 — Negativo** | INT-09 PIX | Cliente criado na pasta 3 |

Se **PEM** estiver vazio, a pasta 3 é **ignorada** (skip) — smoke continua verde para API/gateway.

---

## 5. Teste direto no Inter (mTLS)

Para isolar credenciais **antes** do SaaS:

1. Importar `Projeto_CobrancaBoleto/postman/Inter_Sandbox.postman_collection.json`  
2. Environment `Inter_Sandbox.postman_environment.json` — preencher `inter_client_id` / `inter_client_secret`  
3. Postman → **Settings → Certificates** → host `cdpj-sandbox.partners.uatinter.co` → CRT + KEY  
4. Executar **01 — Obter Token** → **02 — Emitir Boleto**

---

## 6. Evidências e roteiros

- Setup UI: [docs/QA_INTER_SETUP_GUIA_PASSO_A_PASSO.md](../docs/QA_INTER_SETUP_GUIA_PASSO_A_PASSO.md)  
- Matriz homolog: [docs/QA_HOMOLOG_INTER_GATEWAY_PORTAL.md](../docs/QA_HOMOLOG_INTER_GATEWAY_PORTAL.md)  
- Template evidência: [docs/evidencias/INTER_HOMOLOG_TEMPLATE.md](../docs/evidencias/INTER_HOMOLOG_TEMPLATE.md)

---

## 7. Segurança

- Rotacionar `client_secret` se foi exposto em chat/e-mail.  
- Não anexar `.local` nem relatório JSON com tokens em tickets públicos.  
- Screenshots: borrar secrets e PEM.
