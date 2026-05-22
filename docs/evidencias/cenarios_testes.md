# Relatório de cenários — Playwright E2E

**Gerado em:** 2026-05-22T00:34:30.792Z
**Duração total:** 19.0s

## Resumo

| Status | Quantidade |
|--------|------------|
| Passou | 21 |
| Falhou | 0 |
| Ignorado | 3 |

## Cenários por feature

### autenticar seed portal

| Cenário | Status | Duração (ms) | Notas |
|---------|--------|--------------|-------|
| autenticar seed portal | **Passou** | 981 | — |

### Saúde da API

| Cenário | Status | Duração (ms) | Notas |
|---------|--------|--------------|-------|
| Liveness responde OK | **Passou** | 60 | — |
| Readiness com banco migrado | **Passou** | 22 | — |

### Login do portal

| Cenário | Status | Duração (ms) | Notas |
|---------|--------|--------------|-------|
| Login válido redireciona para área autenticada | **Passou** | 1392 | — |
| Login inválido exibe erro | **Passou** | 1171 | — |
| Rota protegida sem sessão | **Passou** | 759 | — |

### Listagem de cobranças

| Cenário | Status | Duração (ms) | Notas |
|---------|--------|--------------|-------|
| Lista carrega sem erro | **Passou** | 752 | — |
| Carregar mais (paginação) | **Passou** | 2053 | — |

### Nova cobrança

| Cenário | Status | Duração (ms) | Notas |
|---------|--------|--------------|-------|
| Criar cobrança com sucesso | **Passou** | 759 | — |
| Nova cobrança a partir do cliente | **Passou** | 655 | — |

### Editar cobrança (Sprint F)

| Cenário | Status | Duração (ms) | Notas |
|---------|--------|--------------|-------|
| Editar valor e vencimento | **Passou** | 951 | — |
| Cobrança paga não permite edição | **Ignorado** | 772 | — |

### Clientes

| Cenário | Status | Duração (ms) | Notas |
|---------|--------|--------------|-------|
| Listar clientes | **Passou** | 818 | — |
| Criar cliente | **Passou** | 1103 | — |
| Editar cliente sem alterar documento | **Passou** | 1009 | — |

### Configurações do escritório (admin)

| Cenário | Status | Duração (ms) | Notas |
|---------|--------|--------------|-------|
| Acesso à página de configurações | **Passou** | 727 | — |
| Utilizador sem perfil admin não acessa | **Ignorado** | 2 | — |

### Escritório e assinatura SaaS

| Cenário | Status | Duração (ms) | Notas |
|---------|--------|--------------|-------|
| Página escritório exibe tenant e link | **Passou** | 712 | — |

### Homolog Asaas — workflow GitHub (Sprint J)

| Cenário | Status | Duração (ms) | Notas |
|---------|--------|--------------|-------|
| Workflow sem secret apenas avisa | **Passou** | 8 | — |
| Workflow com secret gera evidência | **Passou** | 1 | — |
| JSON de evidência não contém segredos | **Passou** | 6 | — |

### Homolog Asaas — execução local

| Cenário | Status | Duração (ms) | Notas |
|---------|--------|--------------|-------|
| Script falha sem DATABASE_URL | **Passou** | 1296 | — |
| Script completo com ambiente válido | **Ignorado** | 2 | — |

### Inbox webhook (API)

| Cenário | Status | Duração (ms) | Notas |
|---------|--------|--------------|-------|
| Webhook duplicado deduplicado | **Passou** | 58 | — |

## Homolog Asaas (script / workflow)

```json
{
  "asaasScript": {
    "case": "missing_database_url",
    "exitCode": 1,
    "ok": true
  },
  "githubWorkflow": {
    "validatedAt": "2026-05-22T00:34:29.227Z",
    "note": "Disparo real no GitHub exige secret ASAAS_API_KEY; job asaas-e2e-not-configured validado estaticamente no YAML.",
    "jobs": [
      "asaas-e2e-not-configured",
      "asaas-e2e"
    ]
  }
}
```

---

*Gerado por `e2e/reporters/evidence-reporter.ts` (Playwright)*