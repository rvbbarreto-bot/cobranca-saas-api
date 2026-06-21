# Autorização PO — Abrir PR P0.1 + P0.2 e merge após gate

**De:** Ricardo Barreto (PO)  
**Para:** Fábrica sênior full-stack + Tech Lead  
**Data:** 30/05/2026  
**Status:** ✅ **AUTORIZADO**

---

## Bloco de autorização (copiar/colar)

```text
AUTORIZAÇÃO PO — PR P0.1 RBAC + P0.2 bloqueio emissão (O.2.2)
Data: 2026-05-30
Repo: cobranca-saas-api

Autorizo a fábrica a:
  1. Commitar alterações locais P0.1 + P0.2
  2. Abrir PR feat/portal-rbac-menu-seed → main
  3. Rodar quality:gate e anexar resultado verde no PR
  4. Solicitar merge ao Tech Lead após CI/review

Escopo do PR:
  - RBAC menu + PortalRoleGuard + seed:dev-rbac
  - Bloqueio preventivo nova cobrança (Inter/Cora/C6 sem endereço)
  - dev-up.ps1 inclui seed:dev-rbac
  - Testes: portal-nav-access, CobrancaFormPage, validate-portal-charge-address

Fora do PR: P2.1 recorrente, Playwright P1.2, reimplementar N.3.1/Inter.

Gate obrigatório pré-merge:
  npm run quality:gate

Assinatura PO: Ricardo Barreto
```

---

## Comandos pré-merge (fábrica)

```powershell
cd cobranca-saas-api
# Docker Desktop aberto
npm ci
npm run migrate
npm run seed:dev
npm run seed:dev-rbac
npm run quality:gate
```

Se `test:integration` falhar por DB: `npm run dev:up` e repetir gate.

---

## Abertura do PR (após gate verde)

```powershell
git checkout -b feat/portal-rbac-menu-seed
git add -A
git status
git commit -m "feat(portal): RBAC menu admin/operador e bloqueio emissão sem endereço (P0.1/P0.2)"
git push -u origin feat/portal-rbac-menu-seed
gh pr create --title "feat(portal): RBAC admin/operador + bloqueio emissão O.2.2" --body "..."
```

**Título sugerido:** `feat(portal): RBAC admin/operador + bloqueio emissão O.2.2`

**Reviewers:** Tech Lead · **Merge:** Tech Lead após gate verde

---

## Resultado quality:gate — 30/05/2026 (execução fábrica)

| Etapa | Resultado |
|-------|-----------|
| `npm run build` | ✅ PASS |
| `npm run test:coverage` | ❌ **FAIL** — linhas **74,92%** (meta **82%**) · branches **70,86%** (meta **72%**) |
| `npm run portal:test` | ✅ **86/86** PASS |
| `npm run test:integration` | ✅ **45/45** (+1 skip) PASS |

**Interpretação PO:** falha de cobertura é **baseline do repo** (não regressão dos arquivos P0.1/P0.2). Tech Lead pode:
- merge com **aceite de risco** documentado no PR, ou
- PR só P0 + ticket separado para elevar cobertura.

**Pré-requisito PR nesta máquina:** instalar **Git** (`git` no PATH) + remote configurado; nesta sessão `git` não estava disponível.
