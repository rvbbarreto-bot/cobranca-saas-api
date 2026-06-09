import { bddTitle } from "../reporters/evidence-reporter";
import { waitForApi } from "../helpers/api-response";
import { test, expect } from "../fixtures/test";
import {
  isFiscalPortalLiveMode,
  isFiscalPortalMockMode,
  pickFiscalE2eCompetencia,
  writeFiscalE2eCsv
} from "../helpers/fiscal-portal";
import { installFiscalPortalMocks } from "../helpers/fiscal-portal-mocks";
import { ensureFiscalPortalLiveSeed, loginFiscalPortalApi } from "../helpers/fiscal-portal-api";

test.describe("Fiscal portal PGDASD (EXEQ-FISC-092)", () => {
  test.describe.configure({ timeout: 180_000 });

  let e2eCompetencia = pickFiscalE2eCompetencia();

  test.beforeEach(async ({ page, request }) => {
    e2eCompetencia = pickFiscalE2eCompetencia();
    if (isFiscalPortalMockMode()) {
      await installFiscalPortalMocks(page, { competencia: e2eCompetencia });
      return;
    }
    const session = await loginFiscalPortalApi(request);
    if (!session?.automacaoTenantId) {
      throw new Error("E2E fiscal live: login API falhou — verifique seed:dev e credenciais.");
    }
    if (!session.fiscalEnabled) {
      throw new Error(
        "E2E fiscal live: módulo fiscal_guias desabilitado no tenant — rode npm run seed:fiscal-portal-e2e."
      );
    }
    await ensureFiscalPortalLiveSeed(request, session);
  });

  test(bddTitle("Fiscal PGDASD", "Upload CSV, stepper e download DAS"), async ({ page }) => {
    if (process.env.E2E_FISCAL_MOCK === "0" && !isFiscalPortalLiveMode()) {
      test.skip(true, "Modo mock desligado — defina E2E_FISCAL_LIVE=1 para API real");
    }

    await page.goto("/processamentos-fiscais/importar");
    const heading = page.getByRole("heading", { name: /Importar PGDASD/i });
    await expect(heading).toBeVisible({ timeout: 15_000 });

    const disabledMsg = page.getByText(/Módulo fiscal desligado/i);
    if (await disabledMsg.isVisible().catch(() => false)) {
      test.skip(true, "VITE_FISCAL_GUIAS_ENABLED=false no portal");
    }

    const csvPath = writeFiscalE2eCsv(e2eCompetencia);

    await page.locator('[data-testid="csv-upload-zone"] input[type="file"]').setInputFiles(csvPath);
    await expect(page.getByText(/pgdasd-/i)).toBeVisible();

    const uploadResp = await Promise.all([
      waitForApi(page, "/v1/portal/fiscal/ingest/csv", "POST"),
      page.getByRole("button", { name: /Enviar e validar/i }).click()
    ]).then(([r]) => r);
    expect(uploadResp.status()).toBeLessThan(300);

    const result = page.locator('[data-testid="fiscal-ingest-result"]');
    await expect(result).toBeVisible({ timeout: 30_000 });
    await expect(result.getByText(/Arquivo validado/i)).toBeVisible({ timeout: 45_000 });
    await expect(page.locator('[data-testid="fiscal-ingest-preview"]')).toBeVisible();

    const startBtn = page.locator('[data-testid="fiscal-start-transmission"]');
    await expect(startBtn).toBeEnabled();

    await Promise.all([
      waitForApi(page, "/v1/portal/fiscal/processamentos", "POST"),
      startBtn.click()
    ]);

    await page.waitForURL(/\/processamentos-fiscais\/[0-9a-f-]+/i, { timeout: 20_000 });

    const stepper = page.locator('[data-testid="fiscal-transmission-stepper"]');
    await expect(stepper).toBeVisible();

    await expect(page.getByTestId("fiscal-live-message")).toContainText(/Processo concluído/i, {
      timeout: 120_000
    });
    await expect(stepper.locator(".fiscal-stepper__item--done")).toHaveCount(5, { timeout: 15_000 });

    const docsPanel = page.locator('[data-testid="processamento-documentos"]');
    await expect(docsPanel).toBeVisible({ timeout: 15_000 });

    const reciboResp = Promise.all([
      page.waitForResponse(
        (r) => r.url().includes("/recibo/url") && r.request().method() === "GET" && r.ok(),
        { timeout: 20_000 }
      ),
      docsPanel.getByRole("button", { name: /Baixar recibo/i }).click()
    ]).then(([r]) => r);
    expect((await reciboResp).status()).toBe(200);

    await page.locator('[data-testid="processamento-ver-guia"]').click();
    await page.waitForURL(/\/guias-fiscais\//, { timeout: 15_000 });

    const downloadBtn = page.getByTestId("guia-detail-actions").getByTestId("guia-pdf-download");
    await expect(downloadBtn).toBeVisible();

    const pdfResp = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes("/pdf-url") && r.request().method() === "GET" && r.ok(),
        { timeout: 20_000 }
      ),
      downloadBtn.click()
    ]).then(([r]) => r);
    expect(pdfResp.status()).toBe(200);
  });
});
