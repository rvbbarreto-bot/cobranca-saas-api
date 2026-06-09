# Wireframes UX — Fiscal MVP SERPRO (Sprint 0)

**Issue:** EXEQ-FISC-003  
**Status:** Draft para aprovação PO  
**Diretriz:** Mobile First · linguagem não técnica · feedback tempo real

---

## 1. Shell (mobile + desktop)

### Mobile (< 640px)

```text
┌─────────────────────────┐
│ ☰  Exeq Fiscal    [👤]  │
├─────────────────────────┤
│                         │
│   (conteúdo da rota)    │
│                         │
├─────────────────────────┤
│ 🏠  📤  📋  ⚠️  ⚙️     │  ← bottom nav fiscal
└─────────────────────────┘
```

### Desktop

```text
┌──────────┬──────────────────────────────────────┐
│ Sidebar  │ Header: Escritório ▾  | Usuário      │
│ (colaps) ├──────────────────────────────────────┤
│ Dashboard│                                      │
│ Empresas │         Área principal               │
│ Upload   │                                      │
│ Histórico│                                      │
│ Erros    │                                      │
│ Config   │                                      │
└──────────┴──────────────────────────────────────┘
```

**Rotas novas:** `/fiscal`, `/fiscal/upload`, `/fiscal/processamentos`, `/fiscal/processamentos/:id`, `/fiscal/erros`, `/fiscal/config`

---

## 2. Dashboard Operacional (`EXEQ-FISC-071`)

```text
┌─────────────────────────────────────┐
│ Olá, [Nome]                         │
│ Competência atual: Maio/2026        │
├─────────────────────────────────────┤
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ │
│ │   12    │ │    2    │ │    1    │ │
│ │ Process.│ │  Erros  │ │ Cert ⚠ │ │
│ └─────────┘ └─────────┘ └─────────┘ │
├─────────────────────────────────────┤
│ [  📤 Enviar arquivo CSV  ]         │  ← CTA primário
├─────────────────────────────────────┤
│ Últimos processamentos              │
│ • Empresa X — Maio — ✅ Concluído   │
│ • Empresa Y — Maio — ⏳ Transmitindo│
└─────────────────────────────────────┘
```

**Copy usuário:** “Processamentos” (não “jobs”); “Transmitindo para Receita” (não “SERPRO API”).

---

## 3. Upload CSV (`EXEQ-FISC-072`)

```text
┌─────────────────────────────────────┐
│ Importar apuração                   │
│ Arraste o CSV ou [ Escolher arquivo ]│
│                                     │
│ Modelo: [ Baixar CSV exemplo ]      │
├─────────────────────────────────────┤
│ ✅ 45 linhas OK  ❌ 2 erros          │
│                                     │
│ Linha 3: CNPJ inválido              │
│ Linha 7: Competência duplicada      │
│                                     │
│ [ Corrigir e reenviar ]             │
│ [ Iniciar transmissão ] (disabled   │
│   até validação OK)                 │
└─────────────────────────────────────┘
```

---

## 4. Stepper transmissão (`EXEQ-FISC-073`)

Estados visuais (polling 3s):

```text
 ① Validado ──●── ② Enviando ──○── ③ Recibo ──○── ④ DAS ──○── ⑤ Pronto

┌─────────────────────────────────────┐
│ Empresa Demo — Maio/2026            │
│                                     │
│ Enviando declaração à Receita…      │
│ ████████░░░░ 60%                    │
│                                     │
│ Isso pode levar alguns minutos.     │
│ Você pode sair; avisaremos quando   │
│ terminar.                           │
└─────────────────────────────────────┘
```

**Estado erro:**

```text
│ ⚠ Não foi possível concluir         │
│ Procuração expirada para este CNPJ. │
│ [ Ver como corrigir ] [ Suporte ]   │
```

---

## 5. Histórico (`EXEQ-FISC-074`)

Filtros: empresa, competência, status. Mobile = cards; desktop = tabela.

```text
┌─────────────────────────────────────┐
│ 🔍 Filtros…                         │
├─────────────────────────────────────┤
│ Empresa Demo    Mai/2026   ✅       │
│ Valor DAS R$ 2.050,00  [ Ver ]      │
├─────────────────────────────────────┤
│ Cliente ABC     Mai/2026   ❌       │
│ Procuração inválida    [ Detalhes ] │
└─────────────────────────────────────┘
```

---

## 6. Central de Erros

Agrupa por código traduzido:

| Código interno | Mensagem usuário |
|----------------|------------------|
| `PROCURACAO_INVALIDA` | Procuração vencida ou não encontrada |
| `CERTIFICADO_EXPIRADO` | Certificado digital expirado |
| `SERPRO_INDISPONIVEL` | Receita temporariamente indisponível — tentaremos de novo |

---

## 7. Config fiscal (cert + procuração + SERPRO)

Tabs: **Certificados** | **Procurações** | **Conexão Receita**

Sem jargão “SERPRO” na UI principal — usar “Receita Federal” / “Conexão oficial”.

---

## 8. Aprovação PO

| Item | OK |
|------|-----|
| Mobile bottom nav | ☐ |
| Stepper 5 passos | ☐ |
| Linguagem leiga | ☐ |
| CTA upload destacado | ☐ |

**PO:** _Aprovar em S0 review_

---

## Aprovação PO — execução imediata

Ver [`AUTORIZACAO_PO_FABRICA_EXECUCAO_IMEDIATA.md`](../AUTORIZACAO_PO_FABRICA_EXECUCAO_IMEDIATA.md) — **AUTORIZADO 2026-06-07**.

---

*Substituir por Figma quando disponível; este doc é referência dev S8.*
