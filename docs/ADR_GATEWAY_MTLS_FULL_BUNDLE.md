# ADR — Pacote completo obrigatório para gateway mTLS (Inter / Cora / C6)

**Status:** Aceito · **Data:** Jun/2026  
**Autores:** PO · Tech Lead · Fábrica  
**Relacionado:** [INTER_ADERENCIA_PORTAL_DEVELOPERS.md](./INTER_ADERENCIA_PORTAL_DEVELOPERS.md) · [LLD-CERT-001](./LLD-CERT-001_Upload_Certificados_PEM_v1.md) · [QA_INTER_SETUP_GUIA_PASSO_A_PASSO.md](./QA_INTER_SETUP_GUIA_PASSO_A_PASSO.md)

---

## Contexto

Operadores podiam alterar **apenas** Client ID ou Client Secret mantendo certificado/chave antigos no banco (merge parcial). Isso gerou erro de alinhamento Inter (OU do cert ≠ client_id) e risco de credenciais incoerentes.

## Decisão

Para provedores **mTLS OAuth** (`inter`, `cora`, `c6`), quando o escritório **já possui** credenciais configuradas:

1. **Qualquer alteração** de credencial exige **pacote completo** numa única operação:
   - novo upload de certificado + chave (`certificate_upload_id`)
   - `client_id` + `client_secret` (e demais campos obrigatórios do registry)
2. **Não** reutilizar PEM anterior via merge parcial.
3. Com `certificate_upload_id`, a API **substitui** o blob cifrado (não faz merge com credenciais antigas).

Primeira configuração (tenant sem credenciais) mantém fluxo atual: upload + OAuth.

## Parâmetro

| Variável | Default | Efeito |
|----------|---------|--------|
| `GATEWAY_MTLS_REQUIRE_FULL_BUNDLE` | `true` | `false` desliga a regra (homolog legado / rollback) |

## Impacto na arquitetura

| Camada | Antes | Depois |
|--------|-------|--------|
| `PATCH /v1/portal/escritorio/gateway` | `mergeGatewayCredentialsPatch` podia manter PEM antigo | Política em `mtls-full-bundle-policy.ts` bloqueia PATCH parcial |
| Upload `POST /certificates/validate` | Retornava CN, validade | + `integration_id_ou` (Inter) para orientar Client ID |
| Portal Configurações | PEM opcional na edição (“deixe em branco para manter”) | Edição mTLS exige re-upload + ID + secret |
| Asaas (api_key) | Inalterado | Inalterado |
| Scripts QA (`qa:inter-push-gateway`) | Já enviam pacote fechado | Compatível |

## Segurança e escala

- **Seguro:** elimina estado stale e mistura de integrações.
- **Escalável:** regra stateless por request; sem migração de schema.
- **Operação:** mais um passo no formulário; frequência baixa (rotação anual / troca de app).

## Testes QA

1. Primeira gravação Inter: upload + client_id + secret → 200.
2. Editar só Client ID sem re-upload → 422 com mensagem de pacote completo.
3. Editar com upload + ID + secret alinhados (OU = client_id) → 200.
4. `GATEWAY_MTLS_REQUIRE_FULL_BUNDLE=false` → comportamento legado (merge) para rollback.

```powershell
npm run qa:inter-check-cert-ou -- "<pasta-cert>" "<client_id>"
npm run test -- tests/platform/mtls-full-bundle-policy.test.ts
```

---

*ADR GATEWAY-MTLS-FULL-BUNDLE — Jun/2026*
