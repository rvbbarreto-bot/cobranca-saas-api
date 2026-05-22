import { bddTitle } from "../reporters/evidence-reporter";
import { waitForApi } from "../helpers/api-response";
import { test, expect } from "../fixtures/test";

function futureDateIso(days = 30): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

test.describe("Editar cobrança (Sprint F)", () => {
  test(bddTitle("Editar cobrança (Sprint F)", "Editar valor e vencimento"), async ({ page }) => {
    const ref = `QA-EDIT-${Date.now()}`;
    await page.goto("/cobrancas/nova");
    await page.getByLabel(/^referência/i).fill(ref);
    await page.getByLabel(/valor/i).fill("150.00");
    await page.getByLabel(/vencimento/i).fill(futureDateIso());
    await Promise.all([
      waitForApi(page, "/v1/portal/cobrancas", "POST"),
      page.getByRole("button", { name: /criar cobrança/i }).click()
    ]);
    await page.goto("/cobrancas");
    const row = page.locator("tr", { has: page.getByText(ref) });
    const editLink = row.getByRole("link", { name: "Editar" });
    await expect(editLink).toBeVisible({ timeout: 15_000 });

    await editLink.click();
    await expect(page).toHaveURL(/\/cobrancas\/[^/]+\/editar/);

    await page.getByLabel(/valor/i).fill("200.00");
    const newDue = new Date();
    newDue.setMonth(newDue.getMonth() + 2);
    await page.getByLabel(/vencimento/i).fill(newDue.toISOString().slice(0, 10));
    const patchResp = await Promise.all([
      waitForApi(page, "/v1/portal/cobrancas/", "PATCH"),
      page.getByRole("button", { name: /^salvar$/i }).click()
    ]).then(([r]) => r);
    expect(patchResp.status()).toBe(200);
    await expect(page).toHaveURL(/\/cobrancas\/[^/]+$/);
  });

  test(bddTitle("Editar cobrança (Sprint F)", "Cobrança paga não permite edição"), async ({ page }) => {
    await page.goto("/cobrancas");
    const pagaRow = page.locator("tr", { has: page.getByText(/pago/i) }).first();
    const exists = await pagaRow.isVisible().catch(() => false);
    test.skip(!exists, "Nenhuma cobrança com status paga no ambiente");

    const editInRow = pagaRow.getByRole("link", { name: "Editar" });
    await expect(editInRow).toHaveCount(0);
  });
});
