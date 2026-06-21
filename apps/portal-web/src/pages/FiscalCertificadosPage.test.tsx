import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { useEffect } from "react";
import { FiscalCertificadosPage } from "./FiscalCertificadosPage";
import type { FiscalA1PemState } from "../components/FiscalA1PemPair";

vi.mock("../lib/fiscal-feature", () => ({
  isFiscalGuiasNavEnabled: () => true
}));

const mockFetchCert = vi.fn();
const mockExpiring = vi.fn();
const mockPostCert = vi.fn();

vi.mock("../components/FiscalA1PemPair", () => ({
  FiscalA1PemPair: ({
    onStateChange,
    resetKey
  }: {
    onStateChange: (state: FiscalA1PemState) => void;
    resetKey?: number;
  }) => {
    useEffect(() => {
      if (resetKey === 0) {
        onStateChange({
          ready: true,
          certificadoPem: "-----BEGIN CERTIFICATE-----\ncert\n-----END CERTIFICATE-----",
          chavePrivadaPem: "-----BEGIN PRIVATE KEY-----\nkey\n-----END PRIVATE KEY-----"
        });
        return;
      }
      onStateChange({ ready: false, certificadoPem: "", chavePrivadaPem: "" });
    }, [onStateChange, resetKey]);
    return <div data-testid="fiscal-a1-pem-pair" />;
  }
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
    }),
    fetchClientes: vi.fn().mockResolvedValue({
      data: [
        {
          id: "c1",
          tenant_id: "t1",
          documento: "11222333000181",
          nome: "Empresa Teste",
          email: null,
          whatsapp_opt_in: false,
          created_at: "",
          updated_at: ""
        }
      ],
      count: 1
    }),
    fetchExpiringCertificates: (...args: unknown[]) => mockExpiring(...args),
    fetchCertificadoDigital: (...args: unknown[]) => mockFetchCert(...args),
    postCertificadoDigital: (...args: unknown[]) => mockPostCert(...args)
  };
});

function renderPage(initial = "/fiscal/certificados"): void {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initial]}>
        <Routes>
          <Route path="/fiscal/certificados" element={<FiscalCertificadosPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("FiscalCertificadosPage (EXEQ-FISC-075)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchCert.mockResolvedValue({ certificado: null });
    mockExpiring.mockResolvedValue({ certificados: [] });
  });

  it("lista empresas e abre formulário PEM", async () => {
    const user = userEvent.setup();
    renderPage();
    expect(await screen.findByTestId("fiscal-cert-list")).toBeInTheDocument();
    expect(screen.getByText("Empresa Teste")).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "Cadastrar" }));
    expect(await screen.findByTestId("fiscal-a1-pem-pair")).toBeInTheDocument();
  });

  it("exibe badge expiração na lista", async () => {
    mockFetchCert.mockResolvedValue({
      certificado: {
        id: "cert-1",
        portal_cliente_id: "c1",
        label: "A1 Homolog",
        valid_from: "2026-01-01",
        valid_until: "2026-06-15",
        ativo: true,
        created_at: "",
        updated_at: ""
      }
    });
    mockExpiring.mockResolvedValue({
      certificados: [
        {
          id: "cert-1",
          portal_cliente_id: "c1",
          label: "A1 Homolog",
          valid_until: "2026-06-15",
          status: "expiring",
          days_left: 5
        }
      ]
    });
    renderPage();
    await waitFor(() => expect(screen.getByText("A1 Homolog")).toBeInTheDocument());
    expect(within(screen.getByTestId("fiscal-cert-list")).getByText(/Expira em 5d/i)).toBeInTheDocument();
  });

  it("substitui certificado, exibe sucesso e desabilita o botão", async () => {
    const user = userEvent.setup();
    mockFetchCert.mockResolvedValue({
      certificado: {
        id: "cert-1",
        portal_cliente_id: "c1",
        label: "A1 Homolog",
        valid_from: "2026-01-01",
        valid_until: "2026-06-15",
        ativo: true,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z"
      }
    });
    mockPostCert.mockResolvedValue({
      certificado: {
        id: "cert-2",
        portal_cliente_id: "c1",
        label: "A1 Homolog",
        valid_from: "2026-01-01",
        valid_until: "2026-06-15",
        ativo: true,
        created_at: "2026-06-06T00:00:00.000Z",
        updated_at: "2026-06-06T00:00:00.000Z"
      }
    });

    renderPage("/fiscal/certificados?cliente=c1");
    const submitBtn = await screen.findByTestId("fiscal-cert-submit-btn");
    await waitFor(() => expect(submitBtn).not.toBeDisabled());
    await user.click(submitBtn);

    expect(await screen.findByTestId("fiscal-cert-save-msg")).toHaveTextContent(/substituído com sucesso/i);
    expect(mockPostCert).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(submitBtn).toBeDisabled());
  });
});
