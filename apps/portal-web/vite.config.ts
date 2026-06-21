import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/v1": {
        target: process.env.VITE_DEV_PROXY_TARGET ?? "http://localhost:3333",
        changeOrigin: true
      }
    }
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      all: false,
      reporter: ["text", "text-summary"],
      include: [
        "src/lib/cliente-fiscal-indicators.ts",
        "src/components/ClienteFiscalIndicatorsCell.tsx",
        "src/hooks/useClienteFiscalIndicators.ts",
        "src/lib/fiscal-audit-ui.ts",
        "src/pages/FiscalAuditoriaPage.tsx"
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        statements: 80,
        branches: 75
      }
    }
  }
});
