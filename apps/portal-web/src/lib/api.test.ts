import { describe, expect, it, vi, afterEach } from "vitest";
import {
  apiUrl,
  portalLogin,
  fetchCobrancas,
  fetchPortalCobrancaDetail,
  fetchPortalMe,
  activateEscritorioAssinatura,
  fetchEscritorioConfig,
  fetchChargingRules,
  shouldPatchSecret,
  fetchClienteCobrancas,
  postPortalCobranca,
  patchPortalCliente,
  patchPortalCobranca,
  clearSession,
  saveSession,
  apiFetch,
  ApiError
} from "./api";
import { STORAGE_ACCESS_TOKEN } from "./storageKeys";

describe("apiUrl", () => {
  it("sempre inclui o path pedido (base vem de import.meta.env em build)", () => {
    const u = apiUrl("/v1/portal/cobrancas");
    expect(u).toContain("/v1/portal/cobrancas");
    expect(u.startsWith("http")).toBe(import.meta.env.VITE_API_BASE_URL?.startsWith("http") ?? false);
  });
});

describe("portalLogin", () => {
  it("extrai access_token do JSON 200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            access_token: "jwt-here",
            token_type: "Bearer",
            expires_in: 900
          })
      })
    );
    const r = await portalLogin({ email: "a@b.co", tenant_id: "1", password: "p" });
    expect(r.access_token).toBe("jwt-here");
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ email: "a@b.co", tenant_id: "1", password: "p" })
      })
    );
  });

  it("traduz falha de rede em mensagem acionavel", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(portalLogin({ email: "a@b.co", tenant_id: "1", password: "p" })).rejects.toSatisfy(
      (e: unknown) => e instanceof ApiError && e.message.includes("Nao foi possivel contactar a API")
    );
  });
});

describe("fetchPortalMe", () => {
  afterEach(() => {
    clearSession();
    vi.unstubAllGlobals();
  });

  it("parseia JSON 200 com user e tenant", async () => {
    saveSession("tok", "tenant-99", "u@x.co");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            user: {
              id: "uuid-1",
              email: "u@x.co",
              full_name: "Nome",
              membership_role: "admin_escritorio",
              jwt_roles: ["owner"]
            },
            tenant: { id: "tenant-99", slug: "esc-1" }
          })
      })
    );
    const me = await fetchPortalMe();
    expect(me.user.email).toBe("u@x.co");
    expect(me.user.membership_role).toBe("admin_escritorio");
    expect(me.tenant.slug).toBe("esc-1");
  });
});

describe("apiFetch em 401", () => {
  afterEach(() => {
    clearSession();
    vi.unstubAllGlobals();
  });

  it("limpa sessao e emite portal:unauthorized", async () => {
    saveSession("bad", "t1", "e@e.co");
    const dispatch = vi.spyOn(window, "dispatchEvent");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => JSON.stringify({ error: "unauthorized", message: "expirado" })
      })
    );
    const res = await apiFetch("/v1/portal/cobrancas", { method: "GET" });
    expect(res.status).toBe(401);
    expect(localStorage.getItem(STORAGE_ACCESS_TOKEN)).toBeNull();
    expect(dispatch).toHaveBeenCalled();
    const evt = dispatch.mock.calls.find((c) => c[0] instanceof Event && (c[0] as Event).type === "portal:unauthorized");
    expect(evt).toBeTruthy();
  });
});

describe("fetchClienteCobrancas", () => {
  afterEach(() => {
    clearSession();
    vi.unstubAllGlobals();
  });

  it("chama GET /v1/portal/clientes/:id/cobrancas", async () => {
    saveSession("t", "tenant-1", "e@e.co");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          data: [],
          count: 0,
          billing_link_status: "ok",
          cliente: { id: "cid", nome: "N", documento: "1" }
        })
    });
    vi.stubGlobal("fetch", fetchMock);
    const r = await fetchClienteCobrancas("cid");
    expect(r.data).toEqual([]);
    expect(r.cliente?.nome).toBe("N");
    const [url] = fetchMock.mock.calls[0] as [string];
    expect(url).toContain("/v1/portal/clientes/cid/cobrancas");
  });
});

describe("postPortalCobranca", () => {
  afterEach(() => {
    clearSession();
    vi.unstubAllGlobals();
  });

  it("envia POST com corpo snake_case da API", async () => {
    saveSession("t", "tenant-1", "e@e.co");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      text: async () =>
        JSON.stringify({
          charge: {
            id: "1",
            reference: "R",
            amount: "10",
            dueDate: "2030-01-01",
            canonicalStatus: "emitida"
          },
          idempotent: false
        })
    });
    vi.stubGlobal("fetch", fetchMock);
    const r = await postPortalCobranca({
      reference: "R",
      idempotency_key: "idem-12345678",
      amount: 10,
      due_date: "2030-01-01"
    });
    expect(r.idempotent).toBe(false);
    expect(r.charge.reference).toBe("R");
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(init.body).toBe(
      JSON.stringify({
        reference: "R",
        idempotency_key: "idem-12345678",
        amount: 10,
        due_date: "2030-01-01"
      })
    );
  });
});

describe("patchPortalCliente", () => {
  afterEach(() => {
    clearSession();
    vi.unstubAllGlobals();
  });

  it("envia PATCH /v1/portal/clientes/:id", async () => {
    saveSession("t", "tenant-1", "e@e.co");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          cliente: {
            id: "cid",
            tenant_id: "tenant-1",
            documento: "12345678901234",
            nome: "Novo",
            email: null,
            whatsapp_opt_in: true,
            created_at: "a",
            updated_at: "b"
          }
        })
    });
    vi.stubGlobal("fetch", fetchMock);
    const r = await patchPortalCliente("cid", { nome: "Novo", whatsapp_opt_in: true });
    expect(r.cliente.nome).toBe("Novo");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/v1/portal/clientes/cid");
    expect(init.method).toBe("PATCH");
    expect(init.body).toBe(JSON.stringify({ nome: "Novo", whatsapp_opt_in: true }));
  });
});

describe("fetchPortalCobrancaDetail", () => {
  afterEach(() => {
    clearSession();
    vi.unstubAllGlobals();
  });

  it("envia GET /v1/portal/cobrancas/:id e devolve payment", async () => {
    saveSession("t", "tenant-1", "e@e.co");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          charge: {
            id: "ch1",
            reference: "R",
            amount: "99.90",
            dueDate: "2030-12-01",
            type: "pix",
            canonicalStatus: "emitida"
          },
          payment: {
            type: "pix",
            boleto_url: null,
            boleto_pdf_url: null,
            boleto_barcode: null,
            pix_qrcode_base64: "abc",
            pix_emv: "00020126",
            pix_link: "https://pix",
            expires_at: "2030-12-01T23:59:59.000Z"
          }
        })
    });
    vi.stubGlobal("fetch", fetchMock);
    const r = await fetchPortalCobrancaDetail("ch1");
    expect(r.payment?.pix_emv).toBe("00020126");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/v1/portal/cobrancas/ch1");
    expect(init.method).toBe("GET");
  });
});

describe("patchPortalCobranca", () => {
  afterEach(() => {
    clearSession();
    vi.unstubAllGlobals();
  });

  it("envia PATCH /v1/portal/cobrancas/:id", async () => {
    saveSession("t", "tenant-1", "e@e.co");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          charge: {
            id: "ch1",
            reference: "R",
            amount: "20",
            dueDate: "2030-02-02",
            canonicalStatus: "emitida"
          }
        })
    });
    vi.stubGlobal("fetch", fetchMock);
    const r = await patchPortalCobranca("ch1", { amount: 20, due_date: "2030-02-02" });
    expect(Number(r.charge.amount)).toBe(20);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/v1/portal/cobrancas/ch1");
    expect(init.method).toBe("PATCH");
  });
});

describe("escritorio config/regua API", () => {
  afterEach(() => {
    clearSession();
    vi.unstubAllGlobals();
  });

  it("fetchEscritorioConfig GET /config", async () => {
    saveSession("tok", "tenant-99", "u@x.co");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            config: { tenant_id: "t1", gateway_provider: "asaas", gateway_api_key: "****abcd" }
          })
      })
    );
    const r = await fetchEscritorioConfig();
    expect(r.config?.gateway_provider).toBe("asaas");
  });

  it("fetchChargingRules GET /regua", async () => {
    saveSession("tok", "tenant-99", "u@x.co");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ data: [{ id: "r1", days_offset: 0, channel: "email", is_active: true }] })
      })
    );
    const r = await fetchChargingRules();
    expect(r.data).toHaveLength(1);
  });

  it("shouldPatchSecret ignora vazio e valor mascarado", () => {
    expect(shouldPatchSecret("", "****abcd")).toBe(false);
    expect(shouldPatchSecret("****abcd", "****abcd")).toBe(false);
    expect(shouldPatchSecret("nova_chave_longa", "****abcd")).toBe(true);
  });
});

describe("activateEscritorioAssinatura", () => {
  afterEach(() => {
    clearSession();
    vi.unstubAllGlobals();
  });

  it("POST activate retorna gatewaySubscriptionId", async () => {
    saveSession("tok", "tenant-99", "u@x.co");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () =>
          JSON.stringify({
            activation: {
              gatewayCustomerId: "cus_1",
              gatewaySubscriptionId: "sub_1",
              status: "active",
              nextDueDate: "2026-06-01"
            }
          })
      })
    );
    const r = await activateEscritorioAssinatura();
    expect(r.activation.gatewaySubscriptionId).toBe("sub_1");
    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/v1/portal/escritorio/assinatura/activate");
    expect(init.method).toBe("POST");
  });
});

describe("fetchCobrancas + sessao", () => {
  it("envia Authorization e x-tenant-id quando ha sessao", async () => {
    saveSession("tok", "tenant-99", "u@x.co");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ data: [], count: 0, billing_link_status: "ok" })
    });
    vi.stubGlobal("fetch", fetchMock);
    const r = await fetchCobrancas();
    expect(r.data).toEqual([]);
    expect(fetchMock).toHaveBeenCalled();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const h = new Headers(init.headers);
    expect(h.get("Authorization")).toBe("Bearer tok");
    expect(h.get("x-tenant-id")).toBe("tenant-99");
    clearSession();
  });
});
