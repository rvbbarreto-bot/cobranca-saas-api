"use strict";

process.env.RUN_PORTAL_CLIENTES_STRESS = "1";

const { spawnSync } = require("node:child_process");
const path = require("node:path");

const root = path.join(__dirname, "..");
const vitestCli = path.join(root, "node_modules", "vitest", "vitest.mjs");
const testFile = "tests/portal-read/portal-clientes-post.integration.test.ts";

const r = spawnSync(process.execPath, [vitestCli, "run", testFile], {
  stdio: "inherit",
  env: process.env,
  cwd: root
});

process.exit(r.status ?? 1);
