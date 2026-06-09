# Homologação Onda 0 — C1 a C3 (pós migration 027)

**Emissor:** Ricardo Barreto (PO)  
**Para:** QA / homologação manual  
**Data:** 28/05/2026  
**Objetivo:** Fechar itens **C1–C3** do checklist P2 que falharam na rodada anterior por **BUG-QA-001** (API clientes → 500 sem migration 027).

**Referências**

| Documento | Uso |
|-----------|-----|
| [QA_P2_POS_MERGE_CHECKLIST.md](./QA_P2_POS_MERGE_CHECKLIST.md) | Checklist mãe (§3 Cliente + endereço) |
| [evidencias/SPRINT_N_HOMOLOG_RELATORIO.md](./evidencias/SPRINT_N_HOMOLOG_RELATORIO.md) | Preencher resultado C1–C3 e assinatura |
| PR **#33** | Correção schema + 503 `schema_migration_required` se migrate pendente |

**Trunk mínimo:** `main` @ **`f9120a6`** ou posterior (merge #33).

---

## 1. O que está em escopo (e o que não está)

### Em escopo nesta homologação

| ID | Regra de negócio (P2.2) |
|----|-------------------------|
| **C1** | Cadastrar cliente **com** endereço completo → persiste e retorna na API |
| **C2** | Cadastrar cliente **sem** endereço → permitido no cadastro |
| **C3** | Atualizar cliente via **PATCH** incluindo `endereco` → campos persistidos |

### Fora de escopo (outras ondas / itens)

- Regressão Asaas **R1–R4**, UX **U1–U5**, gateway **G1–G3**, config **K1–K2** — já exercitados ou em checklist separado; só repetir se regressão suspeita.
- Homolog Inter real (certificado sandbox).
- Edição de endereço **pela tela** `/clientes/:id/editar` — hoje só nome/e-mail/telefone; **C3 é homologado pela API** (contrato P2.2).

---

## 2. Pré-condições obrigatórias (Gate 0)

Executar **antes** de C1–C3. Se falhar, **parar** e acionar DevOps — não registrar FAIL em C1–C3.

| # | Passo | Critério de sucesso |
|---|--------|---------------------|
| P0.1 | `git checkout main && git pull` | Código ≥ `f9120a6` |
| P0.2 | `npm ci && npm run migrate` | Saída: nenhuma migration pendente (inclui **027**) |
| P0.3 | `npm run seed:dev` | Seed OK (`portal-seed@local.dev`) |
| P0.4 | `npm run dev:up` + API rebuild se necessário | Postgres `:5434`, API `:3333` |
| P0.5 | `GET http://localhost:3333/health/ready` | `"portalClienteEndereco": true` |
| P0.6 | `npm run portal:dev` | Portal `:5173` |
| P0.7 | Login portal | E-mail `portal-seed@local.dev` · tenant `escritorio-demo` · senha do seed |

**Evidência Gate 0:** print ou JSON do `/health/ready` com `portalClienteEndereco: true`.

### Teste negativo opcional (ambiente sem 027)

Se existir ambiente de controle **sem** migrate: `POST /v1/portal/clientes` deve retornar **503** com `error: "schema_migration_required"` (não **500**). Documentar como evidência do fix #33.

---

## 3. Dados de teste sugeridos

Usar documentos **únicos** por execução (evitar conflito 409 documento duplicado).

| Campo | Valor exemplo C1 | Valor exemplo C2 |
|-------|------------------|------------------|
| Tipo | Pessoa Física | Pessoa Jurídica |
| CPF/CNPJ | `529.982.247-25` (válido) *ou gerar outro* | `12.345.678/0001-95` *ou gerar outro* |
| Nome | `QA C1 Endereco Completo` | `QA C2 Sem Endereco` |
| E-mail | `qa.c1.endereco@homolog.local` | `qa.c2.sem.endereco@homolog.local` |
| WhatsApp opt-in | Desmarcado | Desmarcado |

**Endereço completo (C1 / C3):**

| Campo | Valor |
|-------|--------|
| CEP | `01310-100` |
| Logradouro | `Avenida Paulista` |
| Número | `1000` |
| Complemento | `Sala QA` |
| Bairro | `Bela Vista` |
| Cidade | `São Paulo` |
| UF | `SP` |

---

## 4. Cenários executáveis

### C1 — Cadastrar cliente **com** endereço completo

**Objetivo:** Validar migration 027 + persistência de `endereco_*` no cadastro.

#### Caminho A — Portal (recomendado)

| Passo | Ação | Resultado esperado |
|-------|------|-------------------|
| 1 | Menu **Clientes** → **Novo cliente** | Formulário abre |
| 2 | Preencher identificação (tipo, documento, nome, e-mail) | Sem erro de validação |
| 3 | Preencher **todos** os campos de endereço (CEP dispara ViaCEP opcional) | Logradouro/bairro/cidade/UF preenchidos |
| 4 | Clicar **Salvar** / submit | Redireciona ou mensagem de sucesso (sem banner vermelho) |
| 5 | Abrir ficha do cliente criado (`/clientes/{id}`) | Página carrega sem erro 500 |
| 6 | *(Opcional)* DevTools → Network → `GET /v1/portal/clientes/{id}` | **200**; corpo contém `endereco` com CEP, logradouro, bairro, cidade, UF |

#### Caminho B — API (evidência contrato)

```http
POST /v1/portal/clientes
Authorization: Bearer {token}
x-tenant-id: escritorio-demo
Content-Type: application/json
```

```json
{
  "documento": "52998224725",
  "nome": "QA C1 Endereco Completo",
  "email": "qa.c1.endereco@homolog.local",
  "whatsapp_opt_in": false,
  "endereco": {
    "cep": "01310100",
    "logradouro": "Avenida Paulista",
    "numero": "1000",
    "complemento": "Sala QA",
    "bairro": "Bela Vista",
    "cidade": "São Paulo",
    "uf": "SP"
  }
}
```

| Verificação | Esperado |
|-------------|----------|
| Status HTTP | **201** |
| Corpo | `id` UUID; objeto `endereco` espelhando campos enviados |
| `GET /v1/portal/clientes/{id}` | **200**; `endereco.cep` = `01310100` (8 dígitos) |

**Falha típica (bug antigo):** **500** → registrar **FAIL** e anexar corpo da resposta + log API.

**Critério PO:** **PASS** somente se cadastro e leitura retornam endereço completo.

**Evidências:** print do formulário preenchido; print da ficha; JSON sanitizado do GET (sem token).

---

### C2 — Cadastrar cliente **sem** endereço

**Objetivo:** Cadastro permitido sem bloco de endereço (colunas `endereco_*` nulas no banco).

#### Caminho A — Portal

| Passo | Ação | Resultado esperado |
|-------|------|-------------------|
| 1 | **Clientes** → **Novo cliente** | Formulário abre |
| 2 | Preencher **apenas** identificação + contato (nome, documento, e-mail) | — |
| 3 | **Deixar vazio** CEP, logradouro, bairro, cidade e UF | — |
| 4 | Salvar | Sucesso (201); sem exigir endereço |
| 5 | Abrir ficha do cliente | Carrega sem erro |
| 6 | Network `GET .../clientes/{id}` | **200**; `endereco` é **`null`** ou ausente de dados preenchidos |

#### Caminho B — API

```json
{
  "documento": "12345678000195",
  "nome": "QA C2 Sem Endereco",
  "email": "qa.c2.sem.endereco@homolog.local",
  "whatsapp_opt_in": false
}
```

*(Não enviar chave `endereco`.)*

| Verificação | Esperado |
|-------------|----------|
| Status HTTP | **201** |
| GET subsequente | **200**; `endereco: null` |

**Critério PO:** **PASS** se cadastro sem endereço não retorna 500 e leitura confirma ausência de endereço.

**Evidências:** print formulário sem endereço; JSON GET com `endereco: null`.

---

### C3 — PATCH cliente incluindo `endereco`

**Objetivo:** Cliente criado em **C2** (sem endereço) recebe endereço via atualização parcial.

**Pré-requisito:** `id` do cliente do **C2** (sem endereço).

> **Nota PO:** A tela `/clientes/:id/editar` **não** expõe endereço ainda. Homologar **C3 via API** (Postman, Insomnia ou curl). UI de PATCH de endereço é evolução futura (Onda A).

#### Passos API

```http
PATCH /v1/portal/clientes/{id_do_C2}
Authorization: Bearer {token}
x-tenant-id: escritorio-demo
Content-Type: application/json
```

```json
{
  "endereco": {
    "cep": "30130100",
    "logradouro": "Avenida Afonso Pena",
    "numero": "100",
    "complemento": null,
    "bairro": "Centro",
    "cidade": "Belo Horizonte",
    "uf": "MG"
  }
}
```

| Passo | Verificação | Esperado |
|-------|-------------|----------|
| 1 | Resposta PATCH | **200**; corpo com `endereco` atualizado |
| 2 | `GET /v1/portal/clientes/{id}` | **200**; `endereco.cidade` = `Belo Horizonte`, `endereco.uf` = `MG` |
| 3 | Recarregar ficha no portal *(opcional)* | Sem erro; *(endereço pode não aparecer na UI até evolução de tela)* |

#### Cenários negativos C3 (opcional, recomendado)

| Caso | Payload | Esperado |
|------|---------|----------|
| CEP inválido | `"cep": "123"` | **422** `validation_error` em `endereco` |
| UF inválida | `"uf": "XX"` | **422** |
| PATCH vazio | `{}` | **422** (nenhum campo para atualizar) |

**Critério PO:** **PASS** se PATCH persiste e GET confirma os campos.

**Evidências:** request/response PATCH e GET (secrets redigidos).

---

## 5. Matriz de resultado (preencher no relatório)

Copiar para [SPRINT_N_HOMOLOG_RELATORIO.md](./evidencias/SPRINT_N_HOMOLOG_RELATORIO.md) §2:

| ID | Resultado | Executor | Data | Evidência |
|----|-----------|----------|------|-----------|
| C1 | PASS / FAIL | | | `prints/` ou JSON |
| C2 | PASS / FAIL | | | |
| C3 | PASS / FAIL | | | |

**Gate G-N-0 (PO):** Onda 0 pode ser **assinada** quando **C1, C2 e C3 = PASS** (e R1 já PASS na rodada anterior ou revalidado).

---

## 6. Definição de pronto (PO)

- [ ] Gate 0 (`portalClienteEndereco: true`) documentado  
- [ ] **C1** PASS — cliente com endereço via portal e/ou API  
- [ ] **C2** PASS — cliente sem endereço  
- [ ] **C3** PASS — PATCH com `endereco` persistido  
- [ ] Nenhum **500** em `POST/GET/PATCH /v1/portal/clientes`  
- [ ] Relatório Sprint N atualizado; BUG-QA-001 marcado **resolvido** se C1–C3 verdes  
- [ ] Assinatura QA + revisão PO no relatório  

---

## 7. Automação de apoio (não substitui homolog manual)

```bash
npm test -- tests/portal-read/portal-cliente-schema.test.ts
npm run test:integration -- tests/portal-read/sprint3-e2e-flow.integration.test.ts
```

Falha em integração com mensagem de coluna `endereco_*` → ambiente sem 027; voltar ao Gate 0.

---

*Documento PO — homologação Onda 0 · itens C1–C3 pós migration 027*
