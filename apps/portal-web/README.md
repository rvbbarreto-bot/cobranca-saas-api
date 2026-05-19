# Portal web (Vite + React + TypeScript)

SPA do portal de cobranças. Consome a API `cobranca-saas-api` em `/v1/portal/*`.

## Comandos

```bash
npm install
npm run dev      # http://localhost:5173 — proxy /v1 → localhost:3333
npm run build
npm test
```

Na raiz do monorepo da API: `npm run portal:dev` / `portal:test` / `portal:build`.

## Documentação

- [../../docs/PORTAL_WEB.md](../../docs/PORTAL_WEB.md)
- [../../docs/PORTAL_WEB_TEST_BATTERY.md](../../docs/PORTAL_WEB_TEST_BATTERY.md)
