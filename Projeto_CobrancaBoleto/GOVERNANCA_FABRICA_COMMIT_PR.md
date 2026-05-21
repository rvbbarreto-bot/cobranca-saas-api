# Governança — Autorização PO para commit e PR (metodologia fábrica)

**Vigência:** Maio 2026  
**Papéis:** PO (produto) · Tech Lead / fábrica (engenharia + agente de IA)  
**Repositório:** `cobranca-saas-api`

---

## 1. Decisão do PO (registro)

O PO **autoriza** o Tech Lead e a fábrica de desenvolvimento a:

1. Criar **commits** em branches `feat/*` ou `fix/*` quando a entrega estiver **pronta para revisão**.
2. Abrir **Pull Request** para `main` **sem esperar pedido explícito de commit** em cada PR, desde que os critérios da secção 2 estejam cumpridos.

**Não autorizado sem alinhamento explícito do PO:**

- Merge direto em `main` (sempre via PR + review).
- `git push --force` em `main` / `master`.
- Commit de secrets, `.env` real, ou artefatos de evidência pessoais fora de `docs/evidencias/` acordados.

---

## 2. Quando a fábrica pode commitar + abrir PR (entrega importante)

Uma entrega é **importante** e pode seguir o fluxo automático commit → push → PR quando **todas** as condições abaixo forem verdadeiras:

| # | Critério | Verificação |
|---|----------|-------------|
| G1 | Escopo fechado (sprint / história P0–P1 do briefing) | Item marcado em `RETOMADA_FABRICA.md` ou `PROMPT_FABRICA_ATUALIZACAO_MAIO2026.md` |
| G2 | `npm run build` sem erro TypeScript | Local ou CI |
| G3 | `npm test` verde (API) | Unitários |
| G4 | `npm run portal:test` verde (se tocou `apps/portal-web`) | Portal |
| G5 | DoD mínimo em `docs/FASE2_KICKOFF_QUALIDADE.md` | Contrato/docs atualizados se mudou API ou rotas SPA |
| G6 | Branch curta `feat/<nome>` a partir de `main` atualizado | `git pull origin main` antes do branch |
| G7 | PR com corpo: Summary + Test plan + referência sprint | Template secção 4 |

**Entregas P2/P3 ou spike:** apenas commit na branch; PR quando o PO priorizar na sessão de 30 min (ritual `RETOMADA_FABRICA.md` §9).

**Exceção:** `npm run quality:gate` (integração + Postgres) — a fábrica **abre o PR** mesmo se o gate só correr no CI; o corpo do PR deve indicar “CI: quality:gate pendente no runner”.

---

## 3. Fluxo operacional (fábrica)

```
1. git fetch origin && git checkout main && git pull
2. git checkout -b feat/<sprint-ou-historia>
3. Implementar + testes + docs
4. npm run build && npm test && (portal:test se aplicável)
5. git add <ficheiros da entrega>   # nunca .env, tmp, docx pessoais
6. git commit -m "<tipo>(<scope>): <resumo>" -m "<porquê / sprint>"
7. git push -u origin HEAD
8. gh pr create --base main --title "..." --body "..."
9. Atualizar RETOMADA_FABRICA (secção 1 e 4) na mesma branch ou follow-up
10. PO: review + merge quando CI verde + demo aceite (se P0/P1)
```

**Tipos de commit (Conventional Commits):**

- `feat` — nova capacidade para o utilizador
- `fix` — correção de bug
- `docs` — só documentação
- `chore` — tooling, scripts, sem mudança de comportamento

---

## 4. Template do PR (copiar no `gh pr create`)

```markdown
## Summary
- <1–3 bullets do que mudou e porquê>

## Sprint / autorização
- Sprint: <ex. Sprint B — portal activate + paginação>
- Governança: PO autorizou commit+PR conforme GOVERNANCA_FABRICA_COMMIT_PR.md
- Branch: `feat/...`

## Test plan
- [ ] `npm run build`
- [ ] `npm test`
- [ ] `npm run portal:test` (se portal)
- [ ] CI / `quality:gate` (GitHub Actions)
- [ ] Demo manual: <passos curtos>

## Fora de escopo
- <o que não entrou neste PR>
```

---

## 5. Responsabilidades

| Papel | Responsabilidade |
|-------|------------------|
| **PO** | Priorizar sprint; aceitar merge após demo/CI; revogar ou restringir autorização por escrito |
| **Tech Lead** | Garantir G1–G7; revisar PRs da fábrica; não mergear o próprio PR sem segundo par se política da equipa exigir |
| **Fábrica (IA/dev)** | Executar secção 3; não commitar lixo; atualizar documentação mestre |

---

## 6. Referências

- [RETOMADA_FABRICA.md](./RETOMADA_FABRICA.md)
- [PROMPT_FABRICA_ATUALIZACAO_MAIO2026.md](./PROMPT_FABRICA_ATUALIZACAO_MAIO2026.md)
- [FASE2_KICKOFF_QUALIDADE.md](../docs/FASE2_KICKOFF_QUALIDADE.md)

---

*Registo PO: autorização ativa para entregas importantes (P0/P1) em Maio 2026.*
