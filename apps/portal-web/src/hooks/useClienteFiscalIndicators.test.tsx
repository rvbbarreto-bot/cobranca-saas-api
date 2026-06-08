import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useClienteFiscalIndicators } from "./useClienteFiscalIndicators";

vi.mock("../lib/fiscal-feature", () => ({
  isFiscalGuiasNavEnabled: () => true
}));

const mockFetchProcessamentos = vi.fn();
const mockFetchExpiring = vi.fn();
const mockFetchCert = vi.fn();
const mockFetchProc = vi.fn();

vi.mock("../lib/api", () => ({
  fetchProcessamentosFiscais: (...args: unknown[]) => mockFetchProcessamentos(...args),
  fetchExpiringCertificates: (...args: unknown[]) => mockFetchExpiring(...args),
  fetchCertificadoDigital: (...args: unknown[]) => mockFetchCert(...args),
  fetchProcuracao: (...args: unknown[]) => mockFetchProc(...args)
}));

function wrapper({ children }: { children: ReactNode }): JSX.Element {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("useClienteFiscalIndicators", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchProcessamentos.mockResolvedValue({ processamentos: [] });
    mockFetchExpiring.mockResolvedValue({ certificados: [] });
    mockFetchCert.mockResolvedValue({ certificado: null });
    mockFetchProc.mockResolvedValue({ procuracao: null });
  });

  it("retorna mapa vazio quando fiscal desligado por lista vazia", async () => {
    const { result } = renderHook(() => useClienteFiscalIndicators([]), { wrapper });
    expect(result.current.enabled).toBe(false);
    expect(result.current.byClienteId.size).toBe(0);
  });

  it("carrega indicadores por cliente", async () => {
    mockFetchProcessamentos.mockResolvedValue({
      processamentos: [
        {
          id: "proc-1",
          portal_cliente_id: "c1",
          fiscal_ingest_id: null,
          competencia: "2026-05",
          tipo: "PGDASD",
          status: "CONCLUIDO",
          valor_apurado: null,
          protocolo_serpro: null,
          recibo_disponivel: false,
          guia_fiscal_id: null,
          erro_codigo: null,
          created_at: "",
          updated_at: "2026-06-01T00:00:00.000Z"
        }
      ]
    });

    const { result } = renderHook(() => useClienteFiscalIndicators(["c1"]), { wrapper });

    await waitFor(() => {
      expect(result.current.byClienteId.get("c1")?.processamento.id).toBe("proc-1");
    });
    expect(mockFetchCert).toHaveBeenCalled();
    expect(mockFetchProc).toHaveBeenCalled();
  });
});
