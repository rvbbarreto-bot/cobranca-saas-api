import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { RelatoriosPage } from "./RelatoriosPage";

const downloadMock = vi.fn();

vi.mock("../lib/api", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../lib/api")>();
  return {
    ...mod,
    downloadEscritorioCobrancasCsv: (...args: unknown[]) => downloadMock(...args)
  };
});

function renderPage(): ReturnType<typeof render> {
  return render(
    <BrowserRouter>
      <RelatoriosPage />
    </BrowserRouter>
  );
}

describe("RelatoriosPage", () => {
  beforeEach(() => {
    downloadMock.mockReset();
    downloadMock.mockResolvedValue(new Blob(["id\n"], { type: "text/csv" }));
    Object.defineProperty(URL, "createObjectURL", {
      value: vi.fn(() => "blob:test"),
      configurable: true
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      value: vi.fn(),
      configurable: true
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
  });

  it("renderiza filtros de data e botao de export", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: /Relatórios/i })).toBeTruthy();
    expect(screen.getByLabelText(/Data inicial/i)).toBeTruthy();
    expect(screen.getByLabelText(/Data final/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Exportar CSV/i })).toBeTruthy();
  });

  it("chama download com from e to ao exportar", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: /Exportar CSV/i }));
    await waitFor(() => expect(downloadMock).toHaveBeenCalledTimes(1));
    const arg = downloadMock.mock.calls[0]?.[0] as { from: string; to: string };
    expect(arg.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(arg.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(arg.from <= arg.to).toBe(true);
  });
});
