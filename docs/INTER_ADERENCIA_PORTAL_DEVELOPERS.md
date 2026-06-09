# Aderência — API Banco Inter vs cobranca-saas-api

**Fonte oficial:** [Portal do desenvolvedor Inter Empresas](https://developers.inter.co/)  
**Estudo interno:** [ESTUDO_APIS_BANCARIAS.md](../Projeto_CobrancaBoleto/ESTUDO_APIS_BANCARIAS.md) §2  
**Homologação:** [QA_HOMOLOG_INTER_GATEWAY_PORTAL.md](./QA_HOMOLOG_INTER_GATEWAY_PORTAL.md)

---

## 1. Fluxo de integração (portal Inter)

Conforme o portal ([developers.inter.co](https://developers.inter.co/)):

1. Login **Internet Banking** Conta PJ  
2. **Soluções para sua empresa** → **Nova integração**  
3. Permissões **Cobrança** (boleto / boleto-cobranca)  
4. **Ativar e baixar** chaves e certificado na mesma aplicação  

O SaaS **não substitui** esse fluxo: persiste o resultado (`client_id`, `client_secret`, PEM) cifrado em `escritorio_config`.

---

## 2. Matriz de aderência técnica

| Requisito Inter | Documentação / contrato | Implementação no projeto | Status |
|-----------------|-------------------------|---------------------------|--------|
| OAuth2 client_credentials | `POST /oauth/v2/token` | `inter-oauth.ts` | OK |
| mTLS no TLS (cert + key PEM) | Certificado emitido pela app | `mtls-agent.ts`, `mtls-fetch.ts` | OK |
| Escopos boleto | `boleto-cobranca.write` `boleto-cobranca.read` | `inter-oauth.ts` scope fixo | OK |
| Host sandbox | `cdpj-sandbox.partners.uatinter.co` | `interBaseUrl(true)` | OK |
| Host produção | `cdpj.partners.bancointer.com.br` | `interBaseUrl(false)` | OK |
| Emissão | `POST /cobrancas/v2` | `inter-adapter.ts` | OK |
| Polling `EM_PROCESSAMENTO` | `GET /cobrancas/v2/{codigoSolicitacao}` | até 3 tentativas no adapter | OK |
| Consulta | `GET /cobrancas/v2/{id}` | `getCharge` | OK |
| Cancelamento | `POST .../cancelar` motivo `ACERTOS` | `cancelCharge` | OK |
| PDF | `GET .../pdf` `Accept: application/pdf` | `downloadBoletoPdf` | OK |
| ID externo | `codigoSolicitacao` | `gatewayTransactionId` / `external_id` | OK |
| `seuNumero` máx. 15 | payload | `seuNumeroFromExternalReference` | OK |
| `numDiasAgenda` máx. 60 | payload | fixo `60` | OK |
| Pagador obrigatório | `pagador.*` | `buildPagador` + `requirePayerAddress` | OK |
| Cache token TTL 3600s, margem 60s | boas práticas | `oauth-token-cache.ts` + margin 60 | OK |
| OU do cert = client_id | regra operacional Inter | `inter-credential-alignment.ts` na validação PATCH | OK (Maio/2026) |
| PIX API dedicada | desabilitada para novas apps | `createPix` → `not_supported` | OK (alinhado ao estudo) |
| Webhook pagamento | registrar URL no portal | inbox genérico; normalização Inter | Parcial |
| Header `X-Inter-Conta-Corrente` | alguns exemplos legados | não exposto na UI | Gap consciente |
| Campo `conta_corrente` em credenciais | opcional em alguns tenants | não no registry | Gap — só se Inter exigir na conta |

---

## 3. O que **não** é credencial Inter API

| Artefato | Uso correto |
|----------|-------------|
| `ca.crt` (webhook) | Cadeia para validar webhook; **não** colar em `certificate_pem` |
| PFX e-CNPJ (ICP-Brasil) | Assinatura fiscal; **não** mTLS OAuth Inter |
| `INTER_*` no `.env` | Apenas scripts locais (`gateway:smoke:inter`, `qa:inter-push-gateway`); **não** persistido pela API |

---

## 4. Reset antes de novas chaves (time)

```powershell
# API/Postgres no ar + .env com DATABASE_URL
npm run qa:inter-reset-credentials
```

Remove do tenant homolog (`00000000-0000-4000-8000-000000000001` por padrão):

- `gateway_provider`, `gateway_credentials_encrypted`, `gateway_api_key_encrypted`, `encryption_iv`
- histórico `gateway_change_log`
- Redis `gw_token:inter:*`

Depois gravar pacote alinhado e rodar `npm run qa:inter-oauth-probe`.

---

## 5. Gates de homologação

| Ordem | Comando | Critério |
|-------|---------|----------|
| 1 | `npm run gateway:smoke:inter` | OAuth OK (mTLS + OU = client_id) |
| 2 | `npm run qa:inter-push-gateway` ou portal Configurações | PATCH 200 |
| 3 | `npm run qa:inter-oauth-probe` | sem mismatch OU |
| 4 | `npm run qa:inter-api` | INT-05b, INT-06 |

---

## 6. Divergências aceitas (produto)

- **PDF no portal:** placeholder `inter://` até pipeline de download servir o binário.  
- **Webhook Inter:** mapear payload `situacao: PAGO` para eventos internos — roadmap P2.  
- **BoletoPix:** emissão via `/cobrancas/v2`; QR no PDF do banco, sem endpoint PIX separado.

---

*Atualizado: Junho 2026 — Tech Lead homolog Inter.*
