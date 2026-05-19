import { describe, expect, it, vi } from "vitest";
import type { PoolClient } from "pg";
import { writeAuditLog } from "../../../src/platform/audit/audit.service";

describe("writeAuditLog", () => {
  it("insere linha em audit_log", async () => {
    const query = vi.fn().mockResolvedValue({ rowCount: 1 });
    const client = { query } as unknown as PoolClient;

    await writeAuditLog(
      {
        tenantId: "tenant-1",
        userId: "user-1",
        action: "login",
        resourceType: "portal.app_user",
        resourceId: "user-1",
        newValue: { ok: true }
      },
      client
    );

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO audit_log"),
      [
        "tenant-1",
        "user-1",
        "login",
        "portal.app_user",
        "user-1",
        null,
        JSON.stringify({ ok: true }),
        null,
        null
      ]
    );
  });
});
