# Sprint 90 — E2E homolog SERPRO mock (EXEQ-FISC-090)

**Gate:** `npm run verify:sprint90`

Pipeline: CSV PGDASD → `TRANSMIT` → recibo PDF → DAS → status `CONCLUIDO` (mock SERPRO).

Evidências: `docs/evidencias/fiscal-serpro-homolog-e2e-*.json` + `docs/evidencias/sprint-90/sprint90-verify-*.json`

Live demo (após FISC-001 PO): `FISCAL_SERPRO_MOCK=false npm run fiscal:serpro:homolog:e2e`
