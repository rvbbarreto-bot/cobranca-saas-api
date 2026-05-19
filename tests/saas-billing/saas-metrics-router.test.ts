import express from "express";
import { describe, expect, it, vi, beforeEach } from "vitest";
import request from "supertest";
import { signAccessToken } from "../../src/modules/identity-access/application/jwt-service";
import { saasBillingRouter } from "../../src/modules/saas-billing/interfaces/http/saas-billing-router";

const metricsMock = vi.fn();

vi.mock("../../src/modules/saas-billing/application/get-platform-metrics", () => ({
  getPlatformMetricsUseCase: (...args: unknown[]) => metricsMock(...args)
}));

function buildApp(roles: ("owner" | "admin")[]) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    process.env.JWT_SECRET = "saas-metrics-router-test";
    const token = signAccessToken({ sub: "u1", tid: "demo", roles });
    req.headers.authorization = `Bearer ${token}`;
    req.authContext = { userId: "u1", tenantId: "demo", roles };
    req.tenantContext = { tenantId: "demo" };
    next();
  });
  app.use("/v1/saas", saasBillingRouter);
  return app;
}

describe("GET /v1/saas/metrics", () => {
  beforeEach(() => {
    metricsMock.mockReset();
    process.env.JWT_SECRET = "saas-metrics-router-test";
    metricsMock.mockResolvedValue({
      mrr: 299,
      currency: "BRL",
      tenants_by_status: { active: 1 },
      inadimplencia: { past_due: 0, suspended: 0, total: 0 },
      generated_at: "2026-05-19T00:00:00.000Z"
    });
  });

  it("200 para owner", async () => {
    const app = buildApp(["owner"]);
    const res = await request(app).get("/v1/saas/metrics").expect(200);
    expect(res.body.metrics.mrr).toBe(299);
    expect(metricsMock).toHaveBeenCalled();
  });

  it("403 para admin sem owner", async () => {
    const app = buildApp(["admin"]);
    await request(app).get("/v1/saas/metrics").expect(403);
    expect(metricsMock).not.toHaveBeenCalled();
  });
});
