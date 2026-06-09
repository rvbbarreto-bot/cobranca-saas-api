import { describe, expect, it, vi, beforeEach } from "vitest";

import { render, screen, waitFor, within } from "@testing-library/react";

import userEvent from "@testing-library/user-event";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { MemoryRouter, Route, Routes } from "react-router-dom";

import { GuiaFiscalDetalhePage } from "./GuiaFiscalDetalhePage";

import { fetchGuiaFiscal, fetchPortalMe, fetchGuiaFiscalPdfUrl } from "../lib/api";



vi.mock("../lib/api", async (importOriginal) => {

  const mod = await importOriginal<typeof import("../lib/api")>();

  return {

    ...mod,

    fetchGuiaFiscal: vi.fn(),

    fetchPortalMe: vi.fn(),

    fetchGuiaFiscalPdfUrl: vi.fn(),

    fetchProcessamentosFiscais: vi.fn().mockResolvedValue({ processamentos: [] }),

    postGuiaPagamento: vi.fn()

  };

});



const mockGuia = vi.mocked(fetchGuiaFiscal);

const mockMe = vi.mocked(fetchPortalMe);

const mockPdf = vi.mocked(fetchGuiaFiscalPdfUrl);



const dasGuia = {

  id: "g-das",

  portal_cliente_id: "c1",

  tipo_guia: "DAS" as const,

  competencia: "2026-05",

  data_vencimento: "2026-05-20",

  valor_principal: 150,

  valor_multa: 0,

  valor_juros: 0,

  valor_total: 150,

  linha_digitavel: null,

  pix_copia_cola: null,

  status: "DISPONIVEL",

  compliance_status: "aprovado",

  compliance_motivo: null,

  pdf_url: null,

  versao_atual: 1,

  created_at: "2026-05-01T00:00:00.000Z",

  updated_at: "2026-05-01T00:00:00.000Z"

};



function renderPage(path: string): void {

  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  render(

    <QueryClientProvider client={qc}>

      <MemoryRouter initialEntries={[path]}>

        <Routes>

          <Route path="/guias-fiscais/:guiaId" element={<GuiaFiscalDetalhePage />} />

        </Routes>

      </MemoryRouter>

    </QueryClientProvider>

  );

}



describe("GuiaFiscalDetalhePage", () => {

  beforeEach(() => {

    vi.clearAllMocks();

    mockMe.mockResolvedValue({

      tenant: { id: "t1", slug: "esc" },

      user: { email: "a@b.com", membership_role: "operador" }

    });

    mockPdf.mockResolvedValue({ pdf_url: "https://example.com/das.pdf", expires_in_seconds: 300 });

  });



  it("destaca guia DARF no cabecalho", async () => {

    mockGuia.mockResolvedValue({

      guia: {

        ...dasGuia,

        id: "g-darf",

        tipo_guia: "DARF",

        competencia: "2026-06",

        linha_digitavel: "85600000000400012340201234567890123456789012345"

      }

    });



    renderPage("/guias-fiscais/g-darf");

    await waitFor(() => {

      expect(screen.getByRole("heading", { name: /Guia DARF — competência 2026-06/i })).toBeInTheDocument();

    });

    const header = document.querySelector(".guia-detail-header--darf");

    expect(header).not.toBeNull();

    expect(within(header as HTMLElement).getByText(/DARF — Receitas Federais/i)).toBeInTheDocument();

  });



  it("destaca guia DAS no cabecalho", async () => {

    mockGuia.mockResolvedValue({ guia: dasGuia });



    renderPage("/guias-fiscais/g-das");

    await waitFor(() => {

      expect(screen.getByText(/Guia DAS — competência 2026-05/i)).toBeInTheDocument();

    });

    expect(document.querySelector(".guia-detail-header--das")).not.toBeNull();

  });



  it("EXEQ-FISC-078: exibe trilha processamento e botão DAS mobile-friendly", async () => {

    mockGuia.mockResolvedValue({ guia: dasGuia });

    renderPage("/guias-fiscais/g-das?processamento=proc-99");



    expect(await screen.findByRole("link", { name: /Ver transmissão PGDASD/i })).toHaveAttribute(

      "href",

      "/processamentos-fiscais/proc-99"

    );

    const downloads = await screen.findAllByTestId("guia-pdf-download");

    expect(downloads.length).toBeGreaterThanOrEqual(1);

    expect(downloads[0]).toHaveClass("guia-pdf-download-btn--full");

    expect(await screen.findByTestId("guia-detail-actions")).toBeInTheDocument();

  });



  it("EXEQ-FISC-078: dispara pdf-url ao baixar DAS", async () => {

    const user = userEvent.setup();

    mockGuia.mockResolvedValue({ guia: dasGuia });

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);



    renderPage("/guias-fiscais/g-das");

    const download = await screen.findAllByTestId("guia-pdf-download");

    await user.click(download[0]);



    await waitFor(() => expect(mockPdf).toHaveBeenCalledWith("g-das"));

    clickSpy.mockRestore();

  });

});


