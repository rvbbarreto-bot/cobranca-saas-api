# Especificação CSV PGDASD — layout v1 (MVP)

**Issue:** EXEQ-FISC-002  
**Sprint:** S0  
**Template:** [`pgdasd-import-v1.csv`](./pgdasd-import-v1.csv)  
**Modelo canônico alvo:** `CanonicalApuracao` (S3)

---

## 1. Escopo v1

Layout **mínimo** para Simples Nacional — apuração mensal por empresa (1 linha = 1 competência por CNPJ).

**Fora v1:** múltiplas atividades detalhadas, retificação, anexos III–V completos (evoluir v2 com contabilidade).

---

## 2. Colunas obrigatórias

| Coluna CSV | Tipo | Exemplo | Regra |
|------------|------|---------|-------|
| `cnpj` | string | `00000000000191` | 14 dígitos, sem máscara |
| `competencia` | string | `2026-05` | `YYYY-MM` |
| `receita_bruta_mes` | decimal | `85000.00` | ≥ 0, ponto decimal |
| `regime_tributario` | enum | `SIMPLES` | MVP: só `SIMPLES` |
| `anexo` | enum | `ANEXO_III` | `ANEXO_I` … `ANEXO_V` |
| `valor_inss` | decimal | `1200.00` | ≥ 0 |
| `valor_icms` | decimal | `0.00` | ≥ 0 |
| `valor_iss` | decimal | `850.00` | ≥ 0 |
| `valor_pis_cofins` | decimal | `0.00` | ≥ 0 |
| `valor_total_das` | decimal | `2050.00` | ≥ 0; conferência |

---

## 3. Colunas opcionais (v1)

| Coluna | Tipo | Notas |
|--------|------|-------|
| `razao_social` | string | Validação cruzada portal.cliente |
| `observacao` | string | Max 500 chars |
| `id_externo_erp` | string | Rastreio Fase 2 |

---

## 4. Mapeamento → CanonicalApuracao

```typescript
// Proposta S3 — src/modules/fiscal-ingestion/domain/canonical-apuracao.schema.ts
{
  cnpj: string;           // col cnpj
  competencia: string;    // col competencia YYYY-MM
  receitaBrutaMes: number;
  regime: "SIMPLES";
  anexo: "ANEXO_I" | "ANEXO_II" | "ANEXO_III" | "ANEXO_IV" | "ANEXO_V";
  tributos: {
    inss: number;
    icms: number;
    iss: number;
    pisCofins: number;
  };
  valorTotalDas: number;
  metadata?: { razaoSocial?, observacao?, idExternoErp? };
}
```

---

## 5. Validações (pipeline)

1. Header CSV exato (ordem flexível se mapeamento por nome)
2. UTF-8; separador `,`; decimal `.`
3. CNPJ dígitos + existência em `portal.cliente` do tenant
4. Competência não futura > 1 mês (configurável)
5. `valor_total_das` ≈ soma tributos ± tolerância R$ 0,02
6. Duplicata (cnpj + competencia) → erro linha

---

## 6. Erros reportados ao usuário

Formato JSON por linha:

```json
{
  "linha": 3,
  "campo": "cnpj",
  "codigo": "CNPJ_INVALIDO",
  "mensagem": "CNPJ deve ter 14 dígitos."
}
```

---

## 7. Aprovação contábil

| Papel | Status | Data |
|-------|--------|------|
| PO | Aprovado MVP mínimo | 2026-06-06 |
| Contabilidade | _Validar v1_ | |

---

*Evoluir para v2 após piloto com escritório parceiro.*
