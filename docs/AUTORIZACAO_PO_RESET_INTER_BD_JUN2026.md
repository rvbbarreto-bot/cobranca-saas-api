# Autorização PO — Reset BD credenciais Inter (nova integração)

**De:** Ricardo Barreto (PO)  
**Para:** Fábrica sênior (full-stack · DevOps · DBA · QA)  
**Data:** 10/06/2026  
**Status:** ✅ **AUTORIZADO EXECUTAR AGORA**  
**Repo:** `cobranca-saas-api`  
**Motivo:** Nova configuração com **pacote completo** Inter (certificado + chave + Client ID + Secret da mesma integração). Remover credenciais antigas/incoerentes do ambiente de homolog.

**Relacionado:** [ADR_GATEWAY_MTLS_FULL_BUNDLE.md](./ADR_GATEWAY_MTLS_FULL_BUNDLE.md) · [QA_INTER_SETUP_GUIA_PASSO_A_PASSO.md](./QA_INTER_SETUP_GUIA_PASSO_A_PASSO.md) §0

---

## Autorização (texto PO — copiar para fábrica)

```text
AUTORIZAÇÃO PO — Limpeza BD credenciais Banco Inter (homolog)
Data: 2026-06-10
Repo: cobranca-saas-api
PO: Ricardo Barreto

AUTORIZO a fábrica (DevOps/DBA) a EXECUTAR AGORA a limpeza das credenciais
de integração Inter gravadas no ambiente de homologação local, para permitir
nova configuração com pacote completo (cert + key + client_id + client_secret
da MESMA aplicação no Portal Developers Inter).

ESCOPO AUTORIZADO:

1) BANCO DE DADOS (tenant demo homolog)
   - Tenant alvo: 00000000-0000-4000-8000-000000000001 (escritorio-demo)
   - Zerar em escritorio_config:
     gateway_provider, gateway_credentials_encrypted,
     gateway_api_key_encrypted, encryption_iv
   - Apagar histórico: gateway_change_log (mesmo tenant)
   - Script preferido: npm run qa:inter-reset-credentials
     (aceito remoção de cobranças de teste do tenant demo neste reset)

2) REDIS (se disponível)
   - Limpar cache OAuth: gw_token:inter:*
   - Limpar uploads temporários: cert_upload:*

3) NÃO ALTERAR
   - ENCRYPTION_KEY no .env da API (chave de cifragem do servidor)
   - Usuários portal / tenants / RBAC
   - Credenciais fiscais SERPRO (módulo separado)
   - Produção — escopo desta autorização é HOMOLOG LOCAL apenas

4) PÓS-LIMPEZA (fábrica + QA)
   - Portal /configuracoes em modo edição sem credenciais mascaradas
   - PO/QA reconfigura Inter com novo pacote alinhado (OU cert = client_id)
   - Evidência: print portal limpo + npm run qa:inter-check-cert-ou OK

RESTRIÇÕES:
- Não commitar secrets (.env, PEM, client_secret) no git
- Não executar em produção sem autorização PO separada
- Registrar evidência em docs/evidencias/ (JSON ou nota curta)

PO: Ricardo Barreto — autorizado em 2026-06-10
```

---

## Comandos (fábrica)

```powershell
cd cobranca-saas-api
$env:DATABASE_URL = "postgres://app:dev_only@localhost:5434/cobranca_saas"
$env:REDIS_URL = "redis://localhost:6379"
$env:QA_PORTAL_TENANT_ID = "00000000-0000-4000-8000-000000000001"

npm run qa:inter-reset-credentials
```

**Alternativa SQL (só gateway, sem apagar cobranças):** ver [QA_INTER_SETUP_GUIA_PASSO_A_PASSO.md](./QA_INTER_SETUP_GUIA_PASSO_A_PASSO.md) §0 e conversa DBA.

---

## Critério de aceite PO

- [ ] `escritorio_config`: sem credenciais gateway cifradas no tenant demo  
- [ ] Portal abre Configurações **sem** “credenciais mascaradas”  
- [ ] Nova gravação Inter com pacote alinhado (upload + OU = Client ID) → PATCH 200  
- [ ] Evidência arquivada em `docs/evidencias/`

---

*PO CobrançaSaaS v2 — reset Inter homolog Jun/2026*
