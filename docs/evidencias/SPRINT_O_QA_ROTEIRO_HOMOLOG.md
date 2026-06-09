# Sprint O — Roteiro de homologação (Onda 0) para QA

**Emissor:** PO (Sprint O)  
**Data:** 28/05/2026  
**Branch alvo:** `feat/sprint-o-completude-cadastro-emissao` → `main`  
**Checklist de assinatura:** [SPRINT_O_HOMOLOG_CHECKLIST.md](./SPRINT_O_HOMOLOG_CHECKLIST.md)

---

## Pré-requisitos (ambiente)

| Item | Comando / URL | Evidência obrigatória |
|------|----------------|------------------------|
| API + DB + Redis | `npm run dev:up` | Print ou JSON de `GET http://localhost:3333/health/ready` com `"status":"ok"` |
| Portal | `npm run portal:dev` | Tela de login em `http://localhost:5173/login` |
| Migrations | Container `migrate` do compose (automático no `dev:up`) | Se `POST /v1/portal/clientes` retornar 503 `schema_migration_required`, rodar migrate antes de continuar |
| Login seed | E-mail/senha do `seed:dev` ou ambiente acordado | Anotar tenant usado (não expor senha no relatório) |
| Gateway | Escritório com **Asaas sandbox** ou gateway ativo em Configurações | Anotar qual gateway (Asaas / Inter / Cora / C6) — cenário 7 depende de Inter/Cora/C6 |

**Critério de bloqueio:** Se `/health/ready` ≠ ok ou portal não abre, registrar bug **BLOQUEANTE** e não assinar O.0.

---

## Cenário 1 — Nova cobrança: vencimento = hoje após 21h (BRT)

**Objetivo:** Validar correção de fuso (America/Sao_Paulo) — não deve retornar 422 indevido.

**Passos**

1. Ajustar relógio do SO **ou** executar entre **21:00 e 23:59 BRT** (preferível).
2. Login → **Nova cobrança**.
3. Selecionar cliente com cadastro mínimo válido (com endereço se gateway exige — ver cenário 7).
4. Valor: `R$ 10,00` (ou mínimo aceito).
5. Vencimento: **data de hoje** (calendário deve permitir hoje).
6. Salvar / criar cobrança.

**Resultado esperado**

- HTTP **201** (ou redirecionamento para detalhe sem toast de erro).
- **Não** aparece mensagem genérica `HTTP 422` nem chave técnica (`due_date`, `invalid_due_date`, etc.) sem texto legível.
- Se 422 legítimo (ex.: valor inválido), mensagem em português no campo ou toast.

**Evidências:** print do formulário com data de hoje + print do detalhe ou Network (status 201).

---

## Cenário 2 — Detalhe boleto: reprocesso sem endereço (cliente incompleto)

**Objetivo:** Reprocesso não deve “sumir” erro nem enfileirar emissão à toa; mensagem legível.

**Pré-condição:** Cobrança em estado que permita reprocesso (`rascunho` / `erro_emissao`) vinculada a cliente **sem** endereço completo (CEP, logradouro, número, cidade, UF, bairro), com gateway que exige endereço (Inter/Cora/C6) **ou** reproduzir com cobrança já falha por endereço.

**Passos**

1. Abrir **Cobranças** → detalhe do boleto.
2. Clicar **Tentar emissão novamente** (ou equivalente).

**Resultado esperado**

- Toast ou banner com texto do tipo: endereço do cliente incompleto ( **não** `portal_cliente_address_required_for_emission` cru).
- Link ou orientação para **editar cliente** quando aplicável.
- Status **não** deve ir para “em andamento”/agendado se a API bloqueou (422).

**Evidências:** print do banner + aba Network (422 com `issues[]` opcional).

---

## Cenário 3 — Detalhe boleto: após reprocesso bem-sucedido (um banner)

**Objetivo:** Não exibir erro antigo + “em andamento” + timeout ao mesmo tempo.

**Pré-condição:** Cobrança com erro de emissão anterior; cliente com endereço completo e gateway configurado.

**Passos**

1. Reprocessar emissão.
2. Aguardar polling (até ~2 min) ou conclusão.

**Resultado esperado**

- **Um** banner principal por vez (erro **ou** andamento **ou** sucesso).
- Após reprocesso, mensagem de erro **anterior** não permanece se houve evento de reprocesso posterior.
- Botão “Tentar novamente” legível (texto escuro/link visível no banner rosa — não branco sobre rosa).

**Evidências:** print sequência (antes/depois) ou vídeo curto.

---

## Cenário 4 — Cadastro cliente: só identificação + contato (sem endereço)

**Passos**

1. **Clientes** → **Novo cliente**.
2. Tipo PJ ou PF; preencher documento válido, nome/razão, e-mail.
3. **Não** preencher bloco de endereço.
4. **Salvar**.

**Resultado esperado**

- HTTP **201**; redirecionamento ou lista com cliente visível.
- Botão Salvar **reage** (não fica silencioso — regressão `bairro` indefinido corrigida).

**Evidências:** print lista + Network POST 201.

---

## Cenário 5 — Cadastro cliente: com CEP + bairro

**Passos**

1. Novo cliente; preencher identificação.
2. CEP válido (ex.: `01310-100`); aguardar ViaCEP; completar número e bairro se necessário.
3. Salvar.
4. Abrir **detalhe** ou **edição** do cliente.

**Resultado esperado**

- Endereço persistido (CEP, logradouro, cidade, UF, bairro visíveis).
- GET cliente retorna objeto `endereco`.

**Evidências:** print edição com campos preenchidos + GET 200 (opcional).

---

## Cenário 6 — Edição cliente: incluir/alterar endereço (O.1)

**Passos**

1. Cliente **sem** endereço (criado no cenário 4) → **Editar**.
2. Preencher endereço completo (CEP, logradouro, número, bairro, cidade, UF).
3. Salvar.

**Resultado esperado**

- PATCH **200**.
- Reabrir edição: dados mantidos.

**Evidências:** print + Network PATCH 200.

---

## Cenário 7 — Nova cobrança: bloqueio preventivo (cliente sem endereço)

**Pré-condição:** Gateway do escritório = **Inter, Cora ou C6** (exige endereço do pagador). Se só Asaas estiver ativo, marcar cenário como **N/A** e registrar no checklist.

**Passos**

1. Selecionar cliente sem endereço completo na **Nova cobrança**.
2. Preencher valor e vencimento válidos.
3. Tentar criar.

**Resultado esperado**

- Submit **bloqueado** ou mensagem clara antes do POST (cliente incompleto para emissão).
- Se POST ocorrer, API pode retornar 422 legível — registrar comportamento observado.

**Evidências:** print do aviso na tela (preferível) ou 422 com mensagem em português.

---

## Registro de bugs e assinatura PO

1. Preencher tabela em [SPRINT_O_HOMOLOG_CHECKLIST.md](./SPRINT_O_HOMOLOG_CHECKLIST.md) (colunas Passou? / Evidência / Observação).
2. Salvar prints em `docs/evidencias/sprint-o/` (criar pasta): `O0-C1-health-ready.json`, `O0-C1-nova-cobranca.png`, etc.
3. Listar bugs remanescentes na seção **Bugs abertos pós O.0** (ID, descrição, severidade).
4. PO assina **Aprovado PO** somente se cenários 1–6 passarem; cenário 7 conforme gateway disponível.

**Gate:** Sem assinatura O.0, **não** homologar O.1/O.2 como aceitos em produção.
