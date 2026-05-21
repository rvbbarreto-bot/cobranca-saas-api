import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";

describe("e2e-asaas-sandbox-evidence script", () => {
  it("falha com exit 1 quando DATABASE_URL ausente", () => {
    const env = { ...process.env, DATABASE_URL: "" };

    const r = spawnSync("npm", ["run", "e2e:asaas:evidence"], {
      cwd: process.cwd(),
      env,
      encoding: "utf8",
      shell: true,
      timeout: 60_000
    });

    expect(r.status).toBe(1);
    expect(`${r.stderr}\n${r.stdout}`).toMatch(/DATABASE_URL ausente/i);
  });
});
