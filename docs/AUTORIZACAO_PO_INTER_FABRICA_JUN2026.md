# Autorização PO — Integração Banco Inter (ajustes + homologação)

**De:** Ricardo Barreto (PO)  
**Para:** Fábrica sênior (full-stack · DevOps · QA)  
**Data:** 02/06/2026  
**Status:** ✅ **AUTORIZADO EXECUTAR AGORA** · 🔄 **FÁBRICA EXECUTOU** (02/06/2026) — aguardando PO/Inter sandbox  
**Repo:** `cobranca-saas-api`  
**Princípio:** fechar **INT-05b / INT-06** com evidência; PRs pequenos; `quality:gate` verde.

---

## 1. Contexto e baseline (estado atual)

| Item | Status | Evidência / nota |
|------|--------|------------------|
| Gateway Inter configurável no portal | ✅ | `ConfiguracoesPage` — modo leitura/edição |
| Worker emissão usa `tenant_id` público (UUID) | ✅ | Fix `payment-emission-processor` |
| Bateria QA API (`npm run qa:inter-api`) | ✅ script | `scripts/qa-inter-api-battery.ts` |
| INT-01 a INT-05a | ✅ PASS | providers, schema, config mascarada, criação cobrança |
| **INT-05b** emissão `emitida` | ❌ FAIL | `unknown_ca` — mTLS rejeitado pelo sandbox Inter |
| **INT-06** `payment_transactions` | ❌ FAIL | consequência de INT-05b |
| Última cobrança teste | — | `110a7928-7faf-4d32-acce-441b552c43c2` → `erro_emissao` |
| Credenciais gravadas | ✅ | `escritorio_config` tenant UUID · `updated_at` 2026-06-02 21:23 UTC |
| Pacote PEM local válido | ✅ | `data/qa-inter-credentials/` (não versionado) |

**Diagnóstico PO:** plataforma OK; bloqueio na **credencial mTLS aceita pelo Inter** (cert + client_id/secret da mesma app sandbox).

**Referências:** [QA_HOMOLOG_INTER_GATEWAY_PORTAL.md](./QA_HOMOLOG_INTER_GATEWAY_PORTAL.md) · [QA_INTER_PACOTE_PEM_LOCAL.md](./QA_INTER_PACOTE_PEM_LOCAL.md) · [QA_TESTE_PO_EMISSAO_BOLETO_INTER.md](./QA_TESTE_PO_EMISSAO_BOLETO_INTER.md)

---

## 2. Autorização PO (copiar/colar na fábrica)

```text
AUTORIZAÇÃO PO — Integração Banco Inter · ajustes e testes
Data: 2026-06-02
Repo: cobranca-saas-api
Time: sênior full-stack + DevOps + QA
PO: Ricardo Barreto

AUTORIZO a fábrica a:

A) CORRIGIR e endurecer integração Inter (código)
   - Validar/decrypt credenciais gravadas vs pacote QA (script diagnóstico, sem logar secrets)
   - Garantir PATCH gateway não envia gateway_credentials vazio (já corrigido — regressão testada)
   - Opcional: script OAuth mTLS direto no sandbox Inter (fora do worker) para isolar PO vs SaaS
   - Opcional: registrar erro mTLS amigável mais cedo no worker (1ª falha → evento visível), sem alterar retry BullMQ

B) HOMOLOGAR com cobranças de teste (autorizado PO)
   - Criar cobranças sandbox (valor simbólico, ex. R$ 3,30) via API/portal
   - Reprocessar emissão em cobranças presas em rascunho/erro_emissao
   - Executar npm run qa:inter-api até INT-05b e INT-06 PASS
   - Não emitir em produção; apenas sandbox Inter + ambiente local/docker

C) CREDENCIAIS e PEM (canal seguro)
   - Usar par oficial Inter API (Inter API_Certificado.crt + Inter API_Chave.key)
   - Client ID / Client Secret da MESMA aplicação no Portal Developers Inter
   - Proibido: e-CNPJ genérico, ca.crt sozinho, PEM incompleto com prompt PowerShell
   - Pacote local: npm run qa:inter-pem (origem C:\Projeto\Inter_API-Chave_e_Certificado)

D) EVIDÊNCIAS
   - Salvar JSON em docs/evidencias/qa-inter-api-battery-*.json
   - Atualizar checklist INT-05/06 em QA_HOMOLOG_INTER_GATEWAY_PORTAL.md quando PASS
   - Registrar charge_id emitida + print detalhe portal (sem secrets)

NÃO AUTORIZADO sem novo RFC PO:
   - Commitar PEM, .env com secrets, ou credenciais reais no repositório
   - Cobranças em produção ou valores altos em sandbox sem PO
   - Refatoração ampla gateway (Asaas/Cora/C6) fora do escopo Inter
   - Desligar retry da fila charges-emission

Gate merge: npm run quality:gate · PR ≤ ~500 linhas · revisão Tech Lead
DoD release homolog Inter: INT-05b + INT-06 PASS na bateria qa:inter-api
```

---

## 3. Plano de execução (ordem sugerida)

| Ordem | ID | Entrega | Responsável | Estimativa |
|-------|-----|---------|-------------|------------|
| **1** | INT-F1 | PO/Tech Lead confirma client_id + secret + cert da mesma app sandbox | PO + TL | 0,5 h |
| **2** | INT-F2 | Regravar credenciais no portal (Editar → Guardar) ou PATCH API homolog | QA | 0,5 h |
| **3** | INT-F3 | Script diagnóstico: OAuth token Inter com credenciais decrypt (opcional) | Dev | 0,5–1 d |
| **4** | INT-F4 | `npm run qa:inter-api` — evidência INT-05b/06 | QA | 1 h (+ fila ~8 min) |
| **5** | INT-F5 | Ajustes código se diagnóstico apontar bug SaaS (não mTLS PO) | Dev | 1–2 d |
| **6** | INT-F6 | PR + merge após gate verde | TL | 0,5 d |

---

## 4. Definition of Done (aceite PO)

| ID | Critério | Verificação |
|----|----------|-------------|
| **INT-05b** | Cobrança teste `rascunho` → **`emitida`** | `GET /v1/portal/cobrancas/:id` · `canonicalStatus=emitida` |
| **INT-06** | Pagamento persistido | `payment` no detalhe · `provider=inter` · linha em `payment_transactions` |
| **Regressão** | Config gateway modo Editar não dispara save | `ConfiguracoesPage.test.tsx` |
| **Regressão** | Emissão usa tenant UUID público | `payment-emission-processor.test.ts` |
| **Evidência** | JSON bateria + charge_id | `docs/evidencias/qa-inter-api-battery-*.json` |
| **Segurança** | Nenhum secret no git / logs / evidência | Revisão TL |

---

## 5. Comandos operacionais (fábrica)

```powershell
# Ambiente
.\scripts\dev-up.ps1

# PEM local (PO)
npm run qa:inter-pem

# Bateria completa (QA)
npm run qa:inter-api

# Só emissão ponta a ponta
npm run qa:inter-charge

# Gate antes do PR
npm run quality:gate
```

**Login dev homolog:** `admin@teste.local` · tenant `escritorio-demo` · senha `TesteDev!2026`  
**API:** http://localhost:3333 · **Portal:** http://localhost:5173

---

## 6. Riscos e mitigação

| Risco | Mitigação |
|-------|-----------|
| `unknown_ca` persiste após regravar PEM | Teste OAuth direto no Inter; PO valida app/cert no portal developers |
| Fila demora ~8 min para `erro_emissao` | QA usa `QA_POLL_MAX_SEC=540`; não abortar antes de 5 tentativas |
| Certificado expirado / app errada | PO confere validade e CN (EXEQ TECNOLOGIA LTDA) |
| ENCRYPTION_KEY trocada após gravar creds | Regravar gateway após estabilizar `.env` |

---

## 7. Assinaturas

| Papel | Nome | Data | Assinatura |
|-------|------|------|------------|
| **PO** | Ricardo Barreto | 02/06/2026 | _________________________ |
| **Tech Lead** | | | _________________________ |
| **QA** | | | _________________________ |

---

## 8. Registro de execução da fábrica (02/06/2026)

| Item | Resultado |
|------|-----------|
| Autorização PO recebida | ✅ |
| `npm run qa:inter-oauth-probe` | ❌ `unknown_ca` |
| Cert DB == pacote QA | ✅ fingerprint `d753dc94404cbf0f` |
| `npm run qa:inter-api` INT-05b/06 | ❌ (reteste 21:32 UTC) |
| Bug SaaS (tenant emissão, UI Editar) | ✅ corrigido antes desta execução |
| **Bloqueio atual** | **Portal Inter** — cert não aceito no mTLS OAuth (PO: alinhar app + cert + secret) |

**Evidência:** [evidencias/qa-inter-fabrica-exec-2026-06-02.json](./evidencias/qa-inter-fabrica-exec-2026-06-02.json)

**Próximo gate DoD:** `npm run qa:inter-oauth-probe` → PASS, depois `npm run qa:inter-api` → INT-05b/06 PASS.

---

*Documento de governança. Dúvidas técnicas → [GATEWAY_UNIVERSAL.md](./GATEWAY_UNIVERSAL.md) · execução QA → [QA_HOMOLOG_INTER_GATEWAY_PORTAL.md](./QA_HOMOLOG_INTER_GATEWAY_PORTAL.md).*
