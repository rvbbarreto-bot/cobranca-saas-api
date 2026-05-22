const { defineConfig, devices } = require("@playwright/test");
const { config: loadEnv } = require("dotenv");
const { join } = require("node:path");

const root = join(__dirname, "..");
loadEnv({ path: join(root, ".env"), override: true });

module.exports = defineConfig({
  testDir: join(__dirname, "tests"),
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  globalSetup: join(__dirname, "global-setup.ts"),
  reporter: [["list"], [join(__dirname, "reporters/evidence-reporter.ts")]],
  use: {
    baseURL: process.env.E2E_PORTAL_URL ?? "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure"
  },
  projects: [
    { name: "setup", testDir: __dirname, testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      testDir: join(__dirname, "tests"),
      testMatch: /.*\.spec\.ts/,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: join(__dirname, ".auth/user.json")
      }
    }
  ]
});
