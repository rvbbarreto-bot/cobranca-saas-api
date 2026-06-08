# Autorização PO — Início de Desenvolvimento (sem Jira)

**Programa:** Evolução Plataforma Exeq — Automação Fiscal SERPRO (PGDAS-D + DAS)  
**Versão:** 1.0  
**Uso:** PO preenche, assina (e-mail ou comentário em PR) e encaminha à fábrica.

---

## 1. Texto de autorização (copiar e enviar)

**Assunto:** [AUTORIZADO] Início de desenvolvimento — Sprint 0 / Fase 1 MVP — independente do Jira

Equipe de desenvolvimento (Fábrica Exeq),

Como **Product Owner** do programa de Automação Fiscal SERPRO, **autorizo formalmente o início imediato do desenvolvimento e da Sprint 0**, mesmo **sem** a integração ou importação do backlog no Jira estar concluída.

### Escopo autorizado a iniciar agora

| # | Entrega | Referência no repositório |
|---|---------|---------------------------|
| 1 | ADR arquitetura SERPRO MVP | `docs/ADR_SERPRO_FISCAL_MVP.md` (a criar na S0) |
| 2 | Especificação layout CSV PGDASD v1 | `docs/templates/pgdasd-import-v1.csv` (a criar) |
| 3 | Wireframes / UX fiscal mobile-first | Anexo Figma ou `docs/ux/` |
| 4 | Spike técnico SERPRO demo (OAuth + consulta) | `scripts/` + evidência em `docs/evidencias/` |
| 5 | Fundação código: org model, vault, ingestion (S1+) | `docs/ANALISE_TECNICA_ARQUITETURAL_SERPRO_MVP.md` |

### Rastreabilidade substituta (até Jira operacional)

Enquanto o Jira **EXEQFISC** não estiver provisionado, a fábrica deve usar:

1. **Backlog canônico:** `docs/JIRA_PACOTE_SERPRO_FISCAL_MVP.md` + `docs/jira-import/JIRA_SERPRO_FISCAL_BACKLOG.csv`
2. **Branches:** `feature/EXEQ-FISC-XXX-descricao-curta` (IDs do pacote Jira, mesmo sem issue no Jira)
3. **Commits:** prefixo `EXEQ-FISC-XXX:` na mensagem
4. **PRs:** título `EXEQ-FISC-XXX — …` + checklist de critérios de aceite do pacote
5. **Registro de sprint:** `docs/evidencias/sprint-0/` (ata daily, decisões, blockers)

**Importação Jira** permanece responsabilidade DevOps, **em paralelo**, sem bloquear código.

### Decisões de negócio já autorizadas

- [ ] **Contratante SERPRO:** CNPJ Exeq centralizado *(ajustar se diferente)*
- [ ] **MVP regime:** Simples Nacional (PGDASD) — DCTFWeb Fase 3
- [ ] **Entrada de dados MVP:** CSV layout v1 — ERP Fase 2
- [ ] **Credenciais SERPRO demo:** spike em paralelo; atraso de contrato **não bloqueia** ADR, CSV spec, UX, migrations locais

### Critério de conclusão Sprint 0 (sem Jira)

- [ ] ADR aprovado (tech lead + PO)
- [ ] Wireframes aprovados (PO)
- [ ] CSV v1 aprovado (contabilidade + PO)
- [ ] Spike SERPRO documentado (sucesso demo **ou** plano B com prazo)
- [ ] Retro S0 em `docs/evidencias/sprint-0/retro-YYYY-MM-DD.md`

### O que **não** inicia sem dependência externa

| Item | Bloqueio | Pode preparar antes? |
|------|----------|----------------------|
| `TRANSDECLARACAO11` em homolog real | Credenciais SERPRO demo/prod | Sim — mocks + contratos |
| Piloto escritório real | Cert A1 + procuração cliente | Sim — homolog local |
| Go-live produção SERPRO | Contrato + homolog | Não |

### Autorização

| Campo | Valor |
|-------|-------|
| PO | _________________________ |
| Data | _________________________ |
| Programa | Automação Fiscal SERPRO — MVP Fase 1 |
| Vigência | Até importação Jira ou encerramento S0, o que ocorrer depois |

Assinatura eletrônica: resposta de e-mail com **“De acordo”** neste texto + data, ou comentário em PR referenciando este arquivo.

---

## 2. Mensagem curta (Slack / Teams)

```
@fábrica PO AUTORIZA início imediato do desenvolvimento e Sprint 0
SEM dependência do Jira (importação DevOps em paralelo).

Backlog canônico: docs/JIRA_PACOTE_SERPRO_FISCAL_MVP.md
Branches/commits: prefixo EXEQ-FISC-XXX
S0: ADR + CSV v1 + wireframes + spike SERPRO

Jira: quando EXEQFISC existir, DevOps importa e vincula PRs retroativamente.
Blocker SERPRO credenciais NÃO para S0 (003, 004, 002).
```

---

## 3. Para o SM / Tech Lead — como operar sem Jira

| Cerimônia | Substituto |
|-----------|------------|
| Sprint backlog | Seção 3 de `JIRA_PACOTE_SERPRO_FISCAL_MVP.md` (issues 001–096) |
| Sprint goal S0 | ADR + CSV + UX + spike SERPRO |
| Daily | Planilha ou `docs/evidencias/sprint-0/daily-*.md` |
| Review | Demo + checklist DoD Sprint 0 (§1 acima) |
| Retro | Arquivo markdown commitado no repo |

### Mapeamento retroativo Jira (quando existir)

Quando DevOps concluir `npm run jira:import:apply`:

1. Criar links manualmente PR → issue, **ou**
2. Re-título PRs com keys geradas pelo Jira (ex.: `EXEQFISC-42`)
3. Registrar mapa `EXEQ-FISC-051 → EXEQFISC-42` em `docs/jira-import/MAPEAMENTO_KEYS.md`

---

## 4. Definition of Ready — primeira story de código (S1)

Pode iniciar **EXEQ-FISC-010** (migration organization) quando:

- [ ] ADR **EXEQ-FISC-004** em review ou aprovado
- [ ] PO autorizou este documento
- [ ] Ambiente local `npm run dev:up` OK
- [ ] Jira **não** é prerequisite

---

## 5. Referências

- Análise técnica: `docs/ANALISE_TECNICA_ARQUITETURAL_SERPRO_MVP.md`
- Pacote backlog: `docs/JIRA_PACOTE_SERPRO_FISCAL_MVP.md`
- Import Jira (paralelo): `docs/jira-import/README.md`

---

*Template PO — preencher campos §1 e comunicar à fábrica.*
