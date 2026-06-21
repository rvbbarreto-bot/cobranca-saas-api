# Memo Tech Lead — Priorização SERPRO live (jwt_token vs procuração EXEQ)

**De:** Tech Lead (fábrica)  
**Para:** Ricardo Barreto (PO) + Backend, Fiscal, QA, DevOps  
**Data:** 2026-06-14  
**Repo:** `cobranca-saas-api`  
**Escritório piloto:** `ricardo` · `ricardo@exeq.com.br` · CNPJ `37229907000137`  
**Status:** ✅ **DECISÃO TOMADA** · 🚀 **P0 EM DESENVOLVIMENTO IMEDIATO**

---

## 1. Análise de dependências técnicas

| Trilho | Descrição | Depende de | Desbloqueia |
|--------|-----------|------------|-------------|
| **A — jwt_token** | Header `jwt_token` (token `autenticar_procurador_token` via `AUTENTICAPROCURADOR/ENVIOXMLASSINADO81` + XML assinado com A1) | OAuth OK ✅ · Certificado A1 no vault ✅ | Transmissão, recibo, DAS, validação SERPRO de procuração |
| **B — Cadastro procuração (portal)** | Registro local `fiscal.procuracao` | Nenhum dev | Gate `FISCAL_SERPRO_REQUIRE_PROCURACAO` |
| **C — Validação procuração SERPRO** | `OBTERPROCURACAO41` live | **A** + B (se procurador ≠ titular) | Pipeline live com flag procuração |

**Conclusão:** A é pré-requisito de C e de qualquer chamada Integra Contador live. B é paralelo (Ops) e não substitui A.

---

## 2. Ordem de execução (P0/P1)

| Prioridade | Item | Responsável |
|------------|------|-------------|
| **P0** | Implementar `jwt_token` no client HTTP live (`ENVIOXMLASSINADO81` + header) | Backend sênior |
| **P0 ∥** | Cadastrar procuração EXEQ no portal + e-CAC (se cenário procurador) | PO + contador |
| **P1** | Homolog live `OBTERPROCURACAO41` + gate pipeline | Backend + QA |
| **P2** | Runbook piloto ricardo + evidências go-live | DevOps + PO |

---

## 3. Paralelo Ops/Contador (sem dev)

- Cadastrar procuração em `/fiscal/procuracoes` (cliente EXEQ).
- Validar procuração no e-CAC Receita Federal.
- Confirmar CNPJ contratante SERPRO = `37229907000137` na Config Fiscal.
- Manter certificado A1 válido (atual: até 2026-09-05).

---

## 4. Critérios de aceite

### A — jwt_token (P0 engenharia)

- [ ] Spike live: consulta Integra Contador **≠ 403 jwt_token**
- [ ] `TRANSDECLARACAO11` demo retorna protocolo ou erro de negócio (não auth)
- [ ] Evidência em `docs/evidencias/sprint-0/`
- [ ] Testes unitários: XML termo + parse token (sem secrets)

### B — Procuração EXEQ (P0 ops)

- [ ] Procuração cadastrada no portal para cliente EXEQ
- [ ] Checklist e-CAC assinado pelo contador

### C — Validação SERPRO (P1)

- [ ] `POST .../procuracoes/validar-serpro` → `situacao: valida` em demo live
- [ ] Pipeline ricardo live com `FISCAL_SERPRO_MOCK=false` conclui ou falha com erro de negócio claro

---

## 5. Estimativa e riscos

| Item | Dias úteis | Risco |
|------|------------|-------|
| A — jwt_token | 3–8 | Médio — XMLDSig, cache token, titular vs procurador |
| B — procuração ops | 0,5–1 | Baixo |
| C — validação live | 1–3 após A | Baixo |

**Riscos:** documentação SERPRO (header `jwt_token` vs `autenticar_procurador_token`); demo SERPRO instável; certificado titular EXEQ pode dispensar procuração e-CAC mas **não** dispensa termo XML assinado.

---

## 6. Decisão piloto EXEQ (`37229907000137`)

1. **Engenharia inicia P0 jwt_token imediatamente** (autorização PO abaixo).
2. **Contador cadastra procuração em paralelo** se o cenário for procurador; se titular = contratante = contribuinte, P1 valida após A.
3. **Mock permanece** para demos até A+C homologados.

---

## 7. Autorização PO — início desenvolvimento P0

```text
AUTORIZO a fábrica a iniciar IMEDIATAMENTE o P0:
  EXEQ-FISC-020 — jwt_token (AUTENTICAPROCURADOR/ENVIOXMLASSINADO81) no client SERPRO live.

Escopo: módulo serpro-integra-contador + resolve-serpro-runtime + spike/homolog ricardo.
Fora de escopo neste P0: refatoração gateway legado, DCTFWeb, produção SERPRO prod.

Gate merge: testes unitários serpro + npm run test:fiscal-serpro verde.
DoD: spike live sem 403 jwt_token OU erro de negócio SERPRO documentado.

PO: Ricardo Barreto — 2026-06-14
```

---

*Referências: [SERPRO Homolog Checklist](./SERPRO_HOMOLOG_CHECKLIST.md) · [Análise Integração SERPRO](./ANALISE_INTEGRACAO_SERPRO_APURACAO_DAS_DARF.md) · evidências `docs/evidencias/sprint-0/serpro-spike-*.json`*
