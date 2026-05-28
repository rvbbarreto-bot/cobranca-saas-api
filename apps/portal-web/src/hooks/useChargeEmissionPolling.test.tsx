import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

const fetchPortalCobrancaDetail = vi.fn();

vi.mock("../lib/api", () => ({
  fetchPortalCobrancaDetail: (...args: unknown[]) => fetchPortalCobrancaDetail(...args)
}));

import {
  useChargeEmissionPolling,
  CHARGE_EMISSION_TIMEOUT_MS
} from "./useChargeEmissionPolling";

const draftNoPayment = {
  charge: { id: "c1", reference: "r", amount: "1", dueDate: "2030-01-01", canonicalStatus: "rascunho" },
  payment: null,
  events: []
};

const emitted = {
  charge: { id: "c1", reference: "r", amount: "1", dueDate: "2030-01-01", canonicalStatus: "emitida" },
  payment: {
    type: "boleto",
    boleto_url: "x",
    boleto_pdf_url: null,
    boleto_barcode: null,
    pix_qrcode_base64: null,
    pix_emv: null,
    pix_link: null,
    expires_at: null
  },
  events: []
};

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("useChargeEmissionPolling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("para o polling e marca timeout após o orçamento sem confirmação", async () => {
    fetchPortalCobrancaDetail.mockResolvedValue(draftNoPayment);

    const { result } = renderHook(() => useChargeEmissionPolling("c1"), {
      wrapper: makeWrapper()
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.isPolling).toBe(true);
    expect(result.current.timeoutReached).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(CHARGE_EMISSION_TIMEOUT_MS + 50);
    });

    expect(result.current.timeoutReached).toBe(true);
    expect(result.current.isPolling).toBe(false);
  });

  it("resetPolling reinicia um novo ciclo de timeout", async () => {
    fetchPortalCobrancaDetail.mockResolvedValue(draftNoPayment);

    const { result } = renderHook(() => useChargeEmissionPolling("c1"), {
      wrapper: makeWrapper()
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(CHARGE_EMISSION_TIMEOUT_MS + 50);
    });
    expect(result.current.timeoutReached).toBe(true);

    act(() => {
      result.current.resetPolling();
    });
    expect(result.current.timeoutReached).toBe(false);
    expect(result.current.isPolling).toBe(true);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(CHARGE_EMISSION_TIMEOUT_MS + 50);
    });
    expect(result.current.timeoutReached).toBe(true);
  });

  it("não marca timeout quando a emissão é confirmada (payment presente)", async () => {
    fetchPortalCobrancaDetail.mockResolvedValue(emitted);

    const { result } = renderHook(() => useChargeEmissionPolling("c1"), {
      wrapper: makeWrapper()
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(CHARGE_EMISSION_TIMEOUT_MS + 50);
    });

    expect(result.current.isPolling).toBe(false);
    expect(result.current.timeoutReached).toBe(false);
  });
});
