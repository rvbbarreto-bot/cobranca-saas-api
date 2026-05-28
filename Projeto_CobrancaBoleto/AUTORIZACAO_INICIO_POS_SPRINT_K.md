# Autorização de início de desenvolvimento — pós Sprint K

**De:** Ricardo Barreto (PO + Lead Tech)  
**Para:** Fábrica Sênior Full-Stack  
**Data:** 28/05/2026  
**Status:** ✅ **APROVADO** — Sprint K encerrado; **Ondas B/D Sprint N concluídas**; **Onda 0 (QA) em execução**

---

## 1. Registro de merge (gates)

| Item | Evidência |
|------|-----------|
| **PR #28** — Sprint K (DLQ, SLI, admin API, `e2e-asaas.yml`) | ✅ `main` (`e734aad`) |
| **PR #29** — Docs autorização pós-K | ✅ `main` (`16cf460`) |
| **PR #27** — Sprint N Ondas **B** (PDF Inter) + **D** (webhook Inter) | ✅ `main` |
| Gaps auditoria B/D | PR `fix/sprint-n-b-d-gaps` (se merge pendente) |

**Trunk único:** `main` @ **`16cf460`** ou posterior.

---

## 2. O que a fábrica deve fazer agora (ordem)

### Passo 0 — Sincronizar ambiente (obrigatório)

```bash
git fetch origin
git checkout main && git pull origin main
npm ci && npm run migrate && npm run seed:dev
npm run build && npm test && npm run portal:test && npm run quality:gate
```

**Não** ramificar de `feat/sprint1-payment-emission-portal`.

### Passo 1 — Pacote vigente: **Onda 0 — Homolog (P0)**

| Prioridade | Onda | Branch | Pacote |
|------------|------|--------|--------|
| **P0** | **0** — QA humano + relatório | `docs/sprint-n-homolog` | [SPRINT_N_HOMOLOG_RELATORIO.md](../docs/evidencias/SPRINT_N_HOMOLOG_RELATORIO.md) |
| P2 | **C** — Relatórios (filtros data) | após Onda 0 | [DEMANDA_SPRINT_N_FASE2_ONDAS_B_D.md](./DEMANDA_SPRINT_N_FASE2_ONDAS_B_D.md) |
| Opcional | Onda A restante (polish portal) | `feat/sprint-n-portal-polish` | [DEMANDA_SPRINT_N_ENTREGA_PRODUTO.md](./DEMANDA_SPRINT_N_ENTREGA_PRODUTO.md) |

### Passo 1b — Ondas B e D (encerradas — não iniciar)

| Onda | Status | Referência |
|------|--------|------------|
| **B** — PDF Inter portal | ✅ **CONCLUÍDO** | PR #27 · [AUDITORIA_SPRINT_N_ONDAS_B_D.md](./AUDITORIA_SPRINT_N_ONDAS_B_D.md) |
| **D** — Webhook Inter | ✅ **CONCLUÍDO** | PR #27 · idem |

---

## 3. Decisões congeladas (continuam válidas)

| Decisão | Valor |
|---------|--------|
| Stack | Express + SQL migrations + Vite/React |
| Gateway por tenant | Factory universal + `escritorio_config.gateway_provider` |
| Erros / filas | Sprint K: `GatewayError.retryable`, DLQ, `/v1/admin/*` |
| Governança | IA abre PR; **Tech Lead merge** — G1–G8 |

---

## 4. Gates de aprovação

| Gate | Status | O que valida |
|------|--------|--------------|
| **G-N-B** | ✅ Encerrado | PDF Inter + testes mock |
| **G-N-D** | ✅ Encerrado | Webhook Inter + fixtures |
| **G-N-0** | **Aberto** | Relatório homolog assinado PO |

---

## 5. Checkpoint operacional (staging)

- [ ] `GET /v1/admin/queues/status`
- [ ] `GET /v1/admin/metrics/sli`
- [ ] Actions → **E2E Asaas (manual)**

---

## 6. SYSTEM PROMPT (colar no Cursor)

```
Repositório: cobranca-saas-api
main @ 16cf460+ (Sprint K #28, docs #29, Sprint N B/D #27)

AUTORIZAÇÃO PO: Ondas B + D CONCLUÍDAS — não reimplementar PDF/webhook Inter.
Foco imediato: Onda 0 QA — docs/evidencias/SPRINT_N_HOMOLOG_RELATORIO.md (branch docs/sprint-n-homolog)
Pacote: Projeto_CobrancaBoleto/DEMANDA_SPRINT_N_FASE2_ONDAS_B_D.md
Gate entrada: npm run quality:gate após git pull main
Governança: GOVERNANCA_FABRICA_COMMIT_PR.md
```

---

*Assinatura digital: Ricardo Barreto — PO + Lead Tech · CobrançaSaaS v2 · atualizado 2026-05-28*
