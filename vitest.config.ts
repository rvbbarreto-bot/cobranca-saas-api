import { defineConfig } from "vitest/config";

/**
 * Cobertura unitária: apenas camadas `application` + `domain` em `src/modules`
 * (lógica de negócio e validação). Meta mínima **82%** linhas/statements — ver `npm run test:coverage`.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    /** Evita carregar `NODE_ENV=production` do `.env` do desenvolvedor durante os testes. */
    env: {
      NODE_ENV: "test"
    },
    setupFiles: ["./tests/setup/vitest-setup.ts"],
    include: [
      "tests/billing-core/**/*.test.ts",
      "tests/portal-read/**/*.test.ts",
      "tests/inbox/**/*.test.ts",
      "tests/platform/**/*.test.ts",
      "tests/tenant-provisioning/**/*.test.ts",
      "tests/payment-gateway/**/*.test.ts",
      "tests/notifications/**/*.test.ts",
      "tests/platform/jobs/**/*.test.ts",
      "tests/health/**/*.test.ts",
      "tests/cross-tenant.integration.test.ts",
      "tests/webhook-charge-status.integration.test.ts",
      "tests/functional/api-battery.integration.test.ts",
      "tests/portal-read/portal-cobranca-emission-flow.integration.test.ts"
    ],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      /**
       * Escopo alinhado à meta de **82%** nos testes unitários: lógica em `application`
       * coberta por testes rápidos. Rotas/infra/JWT/processamento inbox em profundidade
       * ficam na bateria de integração.
       */
      include: [
        "src/modules/billing-core/application/**/*.ts",
        "src/modules/portal-read/application/br-cpf-cnpj.ts",
        "src/modules/portal-read/application/portal-cliente-input.ts",
        "src/modules/portal-read/application/portal-password.ts",
        "src/modules/portal-read/application/patch-portal-charge.ts",
        "src/modules/portal-read/application/portal-list-cursor.ts",
        "src/modules/inbox/application/parse-webhook-charge-payload.ts",
        "src/modules/notifications/application/**/*.ts",
        "src/modules/payment-gateway/domain/**/*.ts",
        "src/platform/jobs/application/**/*.ts",
        "src/modules/tenant-provisioning/application/provision-public-tenant.ts"
      ],
      exclude: ["**/*.d.ts", "**/index.ts"],
      thresholds: {
        lines: 82,
        statements: 82,
        branches: 72,
        functions: 80
      }
    }
  }
});
