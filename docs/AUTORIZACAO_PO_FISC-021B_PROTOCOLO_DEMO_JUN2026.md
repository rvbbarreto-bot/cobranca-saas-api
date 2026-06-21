# Autorização PO — FISC-021b · Protocolo PGDASD SERPRO demo

**De:** Ricardo Barreto (PO)  
**Para:** Fábrica sênior (backend · DevOps · QA · contabilidade piloto)  
**Data autorização:** 2026-06-06  
**Data aceite:** 2026-06-06  
**Status:** ✅ **ENCERRADO — ACEITE PO (limite demo)**  
**Repo:** `cobranca-saas-api`  
**Issue:** EXEQ-FISC-021b  

**Piloto:** tenant `ricardo` · CNPJ `37229907000137` · **titular** (sem procuração e-CAC)

---

## Baseline (já concluído — não reabrir)

| Item | Status |
|------|--------|
| Auth SAPI mTLS + `jwt_token` (sem 403 ICGERENCIADOR-041) | ✅ |
| Payload `TRANSDECLARACAO11` conforme doc SERPRO (`cnpjCompleto`, `declaracao`, `pa`) | ✅ |
| `npm run fisc-021:live` 7/7 | ✅ |
| `npm run test:fiscal-serpro` 51/51 | ✅ |

Referências: [`FISC-021_HOMOLOG_CHECKLIST.md`](./FISC-021_HOMOLOG_CHECKLIST.md) · evidências `docs/evidencias/fisc-021/`

---

## Autorização PO (vigente)

AUTORIZO a fábrica a:

### A) Calibração negócio PGDASD (demo)

- Definir PA de teste com contabilidade/escritório
- Ajustar `idAtividade` / receita / estabelecimento conforme cadastro CNPJ no demo
- Rodar simulação (`FISCAL_SERPRO_PGDASD_SIMULAR=true`) antes de transmissão real, se PO optar

### B) Homolog live demo

- `FISCAL_SERPRO_MOCK=false`
- `FISCAL_SERPRO_REQUIRE_PROCURACAO=false`
- `npm run fisc-021:live`
- `npm run factory:serpro:ricardo`
- Evidências em `docs/evidencias/fisc-021/`

### C) Ajustes técnicos (escopo fechado)

- Correções de mapeamento CSV → PGDASD (anexo/atividade/tributos)
- Flags `FISCAL_SERPRO_PGDASD_SIMULAR` / `FISCAL_SERPRO_PGDASD_COMPARAR`
- Testes unitários + integração sprint4
- PRs `EXEQ-FISC-021b` · ≤ ~500 linhas · `quality:gate` verde

---

## DoD FISC-021b (aceite PO)

- [x] `TRANSDECLARACAO11`: erro de negócio HTTP 400 **documentado e aceito** (limite demo; ver § Aceite formal)
- [x] `factory:serpro:ricardo` 8/9 live — **falha justificada** (`SERPRO_REJEITOU` camada negócio; pipeline mock OK)
- [x] Nenhum 403 auth · nenhum erro de schema (`CnpjCompleto` etc.)
- [x] Evidência JSON datada + checklist FISC-021 atualizado

---

## Aceite formal PO (2026-06-06) — texto assinado

```text
ACEITE FORMAL PO — EXEQ-FISC-021b
Data: 2026-06-06
PO: Ricardo Barreto
Repo: cobranca-saas-api
Piloto: tenant ricardo · CNPJ 37229907000137 · titular (sem procuração)

DECISÃO
Aceito FISC-021b como LIMITE DEMO (Opção 1). Encerramento da demanda de
INTEGRAÇÃO SERPRO titular + payload PGDASD no ambiente demo, sem exigência
de protocolo real neste ciclo.

ESCOPO ENTREGUE
1. Auth SAPI mTLS + jwt_token válido (sem 403 ICGERENCIADOR-041).
2. Payload TRANSDECLARACAO11 conforme doc SERPRO (cnpjCompleto, pa, declaracao).
3. Homolog live fases simulação e transmissão — evidências docs/evidencias/fisc-021/.
4. test:fiscal-serpro 51/51; integração sprint4 OK.

LIMITE DEMO ACEITO
- SERPRO demo retorna HTTP 400 (erro de negócio), não 403 nem erro de schema.
- Protocolo SERPRO real NÃO faz parte do DoD deste aceite.
- factory:serpro:ricardo 8/9 live NÃO bloqueia encerramento (SERPRO_REJEITOU
  registrado como limite de negócio no sandbox).

FORA DO ESCOPO ENCERRADO (follow-up)
- EXEQ-FISC-021c: protocolo demo + factory 9/9 live quando contabilidade
  definir PA, anexo e idAtividade válidos.
- Recibo/DAS live, portal e produção: seguir roadmap sem reabrir 021b salvo
  regressão de auth ou schema.

INSTRUÇÃO À ENGENHARIA
Fábrica encerra WIP em FISC-021b e segue próximas prioridades do roadmap.

Assinatura: Ricardo Barreto · PO Exeq · 2026-06-06
```

Evidência espelho: [`evidencias/fisc-021/fisc-021b-aceite-po-2026-06-06.txt`](./evidencias/fisc-021/fisc-021b-aceite-po-2026-06-06.txt)

---
## Não autorizado sem novo RFC PO

- SERPRO produção / contratante prod
- Procuração e-CAC (`FISCAL_SERPRO_REQUIRE_PROCURACAO=true`)
- Commit de PEM, `.env` ou secrets
- Declaração retificadora em PA com impacto fiscal real sem OK contabilidade
- Valores/competências que alterem obrigação real do cliente fora do sandbox acordado

---

## Responsáveis

| Papel | Responsabilidade |
|-------|------------------|
| Fábrica | Execução técnica + evidências |
| Contabilidade/escritório | PA, receita, anexo/atividade |
| PO | Aceite DoD e encerramento FISC-021b |

---

## Ordem de execução sugerida

```powershell
# Fase 1 — simulação (recomendado)
$env:FISCAL_SERPRO_MOCK="false"
$env:FISCAL_SERPRO_REQUIRE_PROCURACAO="false"
$env:FISCAL_SERPRO_PGDASD_SIMULAR="true"
npm run fisc-021:live

# Fase 2 — transmissão real demo (após OK contabilidade na PA)
$env:FISCAL_SERPRO_PGDASD_SIMULAR="false"
npm run fisc-021:live
npm run factory:serpro:ricardo
```

---

*Documento gerado a partir da autorização PO em 2026-06-06.*
