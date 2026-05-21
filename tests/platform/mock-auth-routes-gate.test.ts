import { describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { mockAuthRoutesGate } from "../../src/platform/http/middleware/mock-auth-routes-gate";

function runGate(env: { nodeEnv?: string; mockAuth?: string }): {
  status: number;
  body: unknown;
  nextCalled: boolean;
} {
  vi.stubEnv("NODE_ENV", env.nodeEnv ?? "test");
  if (env.mockAuth !== undefined) {
    vi.stubEnv("ENABLE_MOCK_AUTH", env.mockAuth);
  }

  let status = 0;
  let body: unknown;
  const res = {
    status: (code: number) => {
      status = code;
      return res;
    },
    json: (payload: unknown) => {
      body = payload;
    }
  } as unknown as Response;

  let nextCalled = false;
  const next: NextFunction = () => {
    nextCalled = true;
  };

  mockAuthRoutesGate({} as Request, res, next);
  vi.unstubAllEnvs();
  return { status, body, nextCalled };
}

describe("mockAuthRoutesGate", () => {
  it("bloqueia com 404 em producao com mocks desligados", () => {
    const r = runGate({ nodeEnv: "production", mockAuth: "false" });
    expect(r.status).toBe(404);
    expect(r.body).toEqual({
      error: "not_found",
      message: "Rota indisponivel neste ambiente."
    });
    expect(r.nextCalled).toBe(false);
  });

  it("permite seguir quando ENABLE_MOCK_AUTH=true", () => {
    const r = runGate({ nodeEnv: "production", mockAuth: "true" });
    expect(r.nextCalled).toBe(true);
  });

  it("permite seguir em development quando mock nao esta forcado a false", () => {
    const r = runGate({ nodeEnv: "development", mockAuth: "" });
    expect(r.nextCalled).toBe(true);
  });
});
