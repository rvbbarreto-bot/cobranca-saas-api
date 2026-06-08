import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { FiscalAuditoriaPage } from "./FiscalAuditoriaPage";

vi.mock("../lib/fiscal-feature", () => ({
  isFiscalGuiasNavEnabled: () => true
}));

const mockFetchAudit = vi.fn();

vi.mock("../lib/api", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../lib/api")>();
  return {
    ...mod,
    fetchPortalMe: vi.fn().mockResolvedValue({
      tenant: { id: "t1", slug: "escritorio-demo" },
      user: {
        id: "u1",
        email: "a@b.com",
        full_name: "Admin",
        membership_role: "admin_escritorio",
        jwt_roles: ["admin_escritorio"]
      },
      modules: { cobranca: true, clientes: true, notas_fiscais: true, fiscal_guias: true, relatorios: true }
    }),
    fetchFiscalAuditLog: (...args: unknown[]) => mockFetchAudit(...args)
  };
});

function renderPage(path = "/fiscal/auditoria"): void {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/fiscal/auditoria" element={<FiscalAuditoriaPage />} />
          <Route path="/auditoria" element={<FiscalAuditoriaPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("FiscalAuditoriaPage (EXEQ-FISC-080)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchAudit.mockResolvedValue({
      entries: [
        {
          id: "a1",
          user_id: "seed-admin",
          action: "download_pdf",
          resource_type: "guia_fiscal",
          resource_id: "g1",
          old_value: null,
          new_value: null,
          ip_address: "127.0.0.1",
          created_at: "2026-06-01T12:00:00.000Z"
        }
      ],
      count: 1,
      next_cursor: null
    });
  });

  it("renderiza tabela read-only com filtros", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Auditoria fiscal/i })).toBeInTheDocument();
    });
    expect(screen.getByTestId("fiscal-audit-filters")).toBeInTheDocument();
    expect(await screen.findByTestId("fiscal-audit-table")).toBeInTheDocument();
    expect(screen.getAllByText("Download PDF").length).toBeGreaterThanOrEqual(1);
  });

  it("aplica filtro de ação", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByTestId("fiscal-audit-table");

    await user.selectOptions(screen.getByLabelText(/Filtrar por ação/i), "upload_certificado");
    await user.click(screen.getByRole("button", { name: /Filtrar/i }));

    await waitFor(() => {
      expect(mockFetchAudit).toHaveBeenCalled();
    });
    const lastCall = mockFetchAudit.mock.calls.at(-1)?.[0] as Record<string, string>;
    expect(lastCall.action).toBe("upload_certificado");
  });

  it("aplica filtros de data e usuário", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByTestId("fiscal-audit-table");

    await user.type(screen.getByLabelText(/Data inicial/i), "2026-06-01");
    await user.type(screen.getByLabelText(/Data final/i), "2026-06-08");
    await user.type(screen.getByLabelText(/Filtrar por usuário/i), "seed-admin");
    await user.click(screen.getByRole("button", { name: /Filtrar/i }));

    await waitFor(() => {
      const lastCall = mockFetchAudit.mock.calls.at(-1)?.[0] as Record<string, string>;
      expect(lastCall.from).toBe("2026-06-01");
      expect(lastCall.to).toBe("2026-06-08");
      expect(lastCall.user_id).toBe("seed-admin");
    });
  });

  it("limpa filtros e refaz consulta", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByTestId("fiscal-audit-table");

    await user.selectOptions(screen.getByLabelText(/Filtrar por ação/i), "download_pdf");
    await user.click(screen.getByRole("button", { name: /Filtrar/i }));
    await user.click(screen.getByRole("button", { name: /Limpar/i }));

    await waitFor(() => {
      const lastCall = mockFetchAudit.mock.calls.at(-1)?.[0] as Record<string, string>;
      expect(lastCall.action).toBeUndefined();
    });
    expect(screen.getByLabelText(/Filtrar por ação/i)).toHaveValue("");
  });

  it("mostra estado vazio quando não há eventos", async () => {
    mockFetchAudit.mockResolvedValue({ entries: [], count: 0, next_cursor: null });
    renderPage();
    expect(await screen.findByText(/Nenhum evento encontrado/i)).toBeInTheDocument();
  });

  it("mostra erro quando a API falha", async () => {
    mockFetchAudit.mockRejectedValue(new Error("Falha de rede"));
    renderPage();
    expect(await screen.findByRole("alert")).toHaveTextContent("Falha de rede");
  });

  it("carrega mais resultados com cursor", async () => {
    mockFetchAudit
      .mockResolvedValueOnce({
        entries: [
          {
            id: "a1",
            user_id: "seed-admin",
            action: "download_pdf",
            resource_type: "guia_fiscal",
            resource_id: "g1",
            old_value: null,
            new_value: null,
            ip_address: "127.0.0.1",
            created_at: "2026-06-01T12:00:00.000Z"
          }
        ],
        count: 2,
        next_cursor: "cursor-page-2"
      })
      .mockResolvedValueOnce({
        entries: [
          {
            id: "a2",
            user_id: null,
            action: "upload_certificado",
            resource_type: "certificado_digital",
            resource_id: "cert-1",
            old_value: null,
            new_value: null,
            ip_address: null,
            created_at: "2026-06-02T12:00:00.000Z"
          }
        ],
        count: 2,
        next_cursor: null
      });

    const user = userEvent.setup();
    renderPage();
    await screen.findByTestId("fiscal-audit-table");
    await user.click(screen.getByRole("button", { name: /Carregar mais/i }));

    await waitFor(() => {
      expect(mockFetchAudit).toHaveBeenCalledTimes(2);
    });
    const secondCall = mockFetchAudit.mock.calls[1]?.[0] as Record<string, string>;
    expect(secondCall.cursor).toBe("cursor-page-2");
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);
  });
});
