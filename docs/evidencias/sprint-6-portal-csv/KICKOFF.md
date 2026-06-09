# Sprint 6 — Upload CSV PGDASD no portal (EXEQ-FISC-072)

- Rota `/processamentos-fiscais/importar`
- Drag-drop, polling validação, erros por linha, iniciar transmissão

# Sprint 7 — Stepper transmissão tempo real (EXEQ-FISC-073)

- Detalhe `/processamentos-fiscais/:id` com polling 3s
- Stepper 5 etapas (vertical mobile)
- Mensagens amigáveis + orientação de erro
- Pós-import CSV redireciona para detalhe do 1º processamento

# Sprint 8 — Histórico + central erros (EXEQ-FISC-074)

- Aba **Histórico**: filtros competência, empresa, status, somente com erro
- Aba **Central de erros**: agrupa por código SERPRO traduzido + ação sugerida

# Sprint 8 — Certificados + Procurações (EXEQ-FISC-075/076)

- `/fiscal/certificados` — lista por empresa, badges expiração, upload PEM (FiscalA1PemPair)
- `/fiscal/procuracoes` — semáforo SERPRO, botão Validar no SERPRO
- `/configuracoes/fiscal` — hub fiscal

## Testes

```powershell
cd apps/portal-web
npm test -- src/lib/fiscal-config-ui.test.ts src/pages/FiscalCertificadosPage.test.tsx src/pages/FiscalProcuracoesPage.test.tsx
```
