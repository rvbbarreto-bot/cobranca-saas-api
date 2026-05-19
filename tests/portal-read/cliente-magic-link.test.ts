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
import {
  signClientePortalToken,
  verifyAccessToken
} from "../../src/modules/identity-access/application/jwt-service";

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
      expect.objectContaining({
        eventType: "magic_link",
        forceChannel: "email",
        metadata: expect.objectContaining({
          clienteId: "cli-1",
          email: "a@test.com",
          tenant_slug: "escritorio-x"
        })
      }),
      expect.objectContaining({ jobName: "magic-link" })
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

  it("verify-token já usado retorna null (used_at preenchido)", async () => {
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes("FOR UPDATE")) {
          return { rows: [] };
        }
        return { rowCount: 0 };
      })
    };
    const r = await verifyClienteMagicLinkToken(client as never, "used-token", "tenant-a");
    expect(r).toBeNull();
  });

  it("verify-token válido emite JWT com role cliente_cnpj", async () => {
    const prev = process.env.JWT_SECRET;
    process.env.JWT_SECRET = "test-secret-magic-link";

    const token = "abc123";
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

    const verified = await verifyClienteMagicLinkToken(client as never, token, "tenant-a");
    expect(verified?.clienteId).toBe("cli-1");

    const jwt = signClientePortalToken(verified!.clienteId, "tenant-a");
    const claims = verifyAccessToken(jwt);
    expect(claims.roles).toContain("cliente_cnpj");
    expect(claims.sub).toBe("cli-1");
    expect(claims.tid).toBe("tenant-a");

    if (prev === undefined) {
      delete process.env.JWT_SECRET;
    } else {
      process.env.JWT_SECRET = prev;
    }
  });
});
