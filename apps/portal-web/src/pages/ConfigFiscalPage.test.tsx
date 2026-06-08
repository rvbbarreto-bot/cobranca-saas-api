import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { ConfigFiscalPage } from "./ConfigFiscalPage";

vi.mock("../lib/fiscal-feature", () => ({
  isFiscalGuiasNavEnabled: () => true
}));

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
    })
  };
});

function renderPage(): void {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <ConfigFiscalPage />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

describe("ConfigFiscalPage (hub EXEQ-FISC-075/076)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza hub com links para certificados e procurações", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Configuração fiscal/i })).toBeInTheDocument();
    });
    expect(screen.getByRole("heading", { name: /Certificados A1/i, level: 3 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Procurações$/i, level: 3 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Conexão Receita Federal/i, level: 3 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Auditoria fiscal/i, level: 3 })).toBeInTheDocument();
  });

  it("menciona homolog stub", async () => {
    renderPage();
    expect(await screen.findByText(/FISCAL_CAPTURE_STUB/i)).toBeInTheDocument();
  });
});
