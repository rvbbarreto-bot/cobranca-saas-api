# Sprint O — Checklist homolog regressão (O.0)

**Ambiente:** `npm run dev:up` + `npm run portal:dev`  
**API:** http://localhost:3333/health/ready → `status: ok`  
**Portal:** http://localhost:5173/login  

| # | Cenário | Passou? | Evidência (print/arquivo) | Observação |
|---|---------|---------|---------------------------|------------|
| 1 | Nova cobrança — vencimento = hoje (após 21h BRT) | ☐ | | Sem HTTP 422 indevido |
| 2 | Detalhe boleto — reprocesso sem endereço | ☐ | | Toast/422 legível; status não vai a agendado à toa |
| 3 | Detalhe boleto — após reprocesso | ☐ | | Um banner por vez (sem erro antigo + andamento) |
| 4 | Cadastro cliente — só identificação + contato | ☐ | | Salva e lista |
| 5 | Cadastro cliente — com CEP + bairro | ☐ | | Endereço gravado |
| 6 | Edição cliente — incluir endereço (O.1) | ☐ | | PATCH 200 |
| 7 | Nova cobrança — cliente sem endereço (Inter/Cora/C6) | ☐ | | Bloqueio preventivo (O.2.2) |

**Aprovado PO:** _______________ **Data:** ___________

**Bugs remanescentes:** (registrar abaixo)

---

### Bugs abertos pós O.0

| ID | Descrição | Severidade | Sprint |
|----|-----------|------------|--------|
