# QA — Portal UI tokens e acessibilidade (P0)

## Escopo desta entrega

- Tokens globais (`apps/portal-web/src/styles/theme-tokens.css`)
- Tema claro/escuro com persistência (`useTheme`, botão no menu lateral)
- ComboBox cliente (`ClienteAutocomplete`) — Nova Cobrança Avulsa
- DatePicker (`BrDatePicker`) — Nova Cobrança Avulsa
- Estilos globais de inputs/selects/modais no `index.css`

## Como testar (passo a passo)

1. `npm run dev:up` e `npm run portal:dev` (ou `npm run dev:up` se já incluir portal).
2. Login: `portal-seed@local.dev` / tenant `escritorio-demo` / `PortalSeedDev!ChangeMe1`.
3. **Nova Cobrança Avulsa** (`/cobrancas/nova`):
   - Tema claro: dropdown cliente com fundo branco, nome escuro, CPF/CNPJ legível, hover suave, item selecionado destacado.
   - Placeholder: "Digite o nome, CPF ou CNPJ do cliente".
   - Label: "Cliente (pagador obrigatório)" quando gateway exige pagador.
   - Calendário: fundo claro, Dom–Sáb visíveis, mês/ano legível, navegação ‹ ›, hoje com borda, selecionado em teal, sombra no popover.
4. Alternar **Tema escuro** no rodapé do menu lateral; repetir passos 3.
5. Navegação exploratória P1: Dashboard, Clientes, Boletos, Configurações — verificar inputs/selects e cards.

## Critérios de aceite (checklist)

- [ ] Dropdown cliente legível no tema claro
- [ ] Hover e seleção visíveis no dropdown
- [ ] Placeholder e label completos
- [ ] Calendário legível (normal, hover, hoje, selecionado, desabilitado)
- [ ] Tema escuro sem regressão de contraste nos componentes acima
- [ ] `npm run portal:test` verde
- [ ] Sem alteração de endpoints/regras de negócio

## Evidências

Registrar prints em `docs/evidencias/prints/`:

- `portal-p0-dropdown-light-antes.png` / `depois.png` (se disponível)
- `portal-p0-calendar-light.png`
- `portal-p0-dropdown-dark.png`
- `portal-p0-calendar-dark.png`

## Impacto em integrações

Nenhum — alterações restritas a CSS/componentes visuais do portal.
