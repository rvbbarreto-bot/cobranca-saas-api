import { describe, expect, it, vi, beforeEach } from "vitest";
import { createHash } from "node:crypto";

const { enqueueMock } = vi.hoisted(() => ({
  enqueueMock: vi.fn().mockResolvedValue(undefined)
}));

vi.mock("../../src/platform/jobs/enqueue-notification", () => ({
  enqueueNotificationJob: enqueueMock
}));

import {
  requestClienteMagicLink,
  verifyClienteMagicLinkToken
} from "../../src/modules/portal-read/application/cliente-magic-link";

describe("cliente magic link", () => {
  beforeEach(() => {
    enqueueMock.mockClear();
  });

  it("request-access com e-mail existente enfileira magic link", async () => {
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes("FROM portal.cliente")) {
          return {
            rows: [{ id: "cli-1", email: "a@test.com", nome: "Ana" }]
          };
        }
        return { rowCount: 1 };
      })
    };

    const r = await requestClienteMagicLink(client as never, {
      email: "a@test.com",
      automacaoTenantId: "tenant-a",
      tenantSlug: "escritorio-x"
    });

    expect(r.enqueued).toBe(true);
    expect(enqueueMock).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "magic_link" }),
      expect.any(Object)
    );
  });

  it("request-access sem cliente retorna enqueued false", async () => {
    const client = {
      query: vi.fn(async () => ({ rows: [] }))
    };
    const r = await requestClienteMagicLink(client as never, {
      email: "nao@test.com",
      automacaoTenantId: "tenant-a",
      tenantSlug: "x"
    });
    expect(r.enqueued).toBe(false);
    expect(enqueueMock).not.toHaveBeenCalled();
  });

  it("verify-token válido retorna clienteId", async () => {
    const token = "abc123";
    const hash = createHash("sha256").update(token).digest("hex");
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes("FOR UPDATE")) {
          return {
            rows: [{ id: "tok-1", tenant_id: "tenant-a", cliente_id: "cli-1" }]
          };
        }
        return { rowCount: 1 };
      })
    };

    const r = await verifyClienteMagicLinkToken(client as never, token, "tenant-a");
    expect(r?.clienteId).toBe("cli-1");
  });

  it("verify-token expirado retorna null", async () => {
    const client = {
      query: vi.fn(async () => ({ rows: [] }))
    };
    const r = await verifyClienteMagicLinkToken(client as never, "x", "tenant-a");
    expect(r).toBeNull();
  });
});
