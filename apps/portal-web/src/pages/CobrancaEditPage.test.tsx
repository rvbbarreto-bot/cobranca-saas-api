import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { CobrancaEditPage } from "./CobrancaEditPage";

const patchCobrancaMock = vi.fn();

vi.mock("../lib/api", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../lib/api")>();
  return {
    ...mod,
    fetchPortalCobrancaDetail: vi.fn().mockResolvedValue({
      charge: {
        id: "ch-edit-1",
        reference: "REF-EDIT",
        amount: "150.00",
        dueDate: "2031-06-15",
        canonicalStatus: "emitida"
      },
      payment: null
    }),
    patchPortalCobranca: (...args: unknown[]) => patchCobrancaMock(...args)
  };
});

function renderPage(): ReturnType<typeof render> {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/cobrancas/ch-edit-1/editar"]}>
        <Routes>
          <Route path="/cobrancas/:chargeId/editar" element={<CobrancaEditPage />} />
          <Route path="/cobrancas/:chargeId" element={<div>Detalhe</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("CobrancaEditPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    patchCobrancaMock.mockResolvedValue({
      charge: {
        id: "ch-edit-1",
        reference: "REF-EDIT",
        amount: "200.00",
        dueDate: "2031-07-01",
        canonicalStatus: "emitida"
      }
    });
  });

  it("renderiza formulario de edicao", async () => {
    renderPage();
    expect(await screen.findByText(/Edição do boleto/i)).toBeTruthy();
    const amountInput = (await screen.findByLabelText(/Valor/i)) as HTMLInputElement;
    expect(amountInput.value).toBe("150.00");
    expect(await screen.findByDisplayValue("2031-06-15")).toBeTruthy();
  });

  it("submete PATCH com valor e vencimento", async () => {
    const user = userEvent.setup();
    renderPage();
    const amountInput = await screen.findByLabelText(/Valor/i);
    // fireEvent evita flakiness de <input type="number"> no Linux CI (clear+type vira "150200").
    fireEvent.change(amountInput, { target: { value: "200" } });
    await user.click(screen.getByRole("button", { name: /Salvar/i }));
    await waitFor(() => expect(patchCobrancaMock).toHaveBeenCalled());
    expect(patchCobrancaMock).toHaveBeenCalledWith(
      "ch-edit-1",
      expect.objectContaining({ amount: 200, due_date: "2031-06-15" })
    );
  });
});
