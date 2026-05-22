import { bddTitle } from "../reporters/evidence-reporter";
import { waitForApi } from "../helpers/api-response";
import { test, expect } from "../fixtures/test";

function futureDateIso(days = 30): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

test.describe("Nova cobrança", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/escritorio");
    const warn = page.locator(".banner-warn");
    if (await warn.isVisible().catch(() => false)) {
      const text = await warn.textContent();
      test.skip(true, `Billing link: ${text ?? "aviso"}`);
      return;
    }
  });

  test(bddTitle("Nova cobrança", "Criar cobrança com sucesso"), async ({ page, net }) => {
    const ref = `QA-REF-${Date.now()}`;
    await page.goto("/cobrancas/nova");
    await page.getByLabel(/^referência/i).fill(ref);
    await page.getByLabel(/valor/i).fill("150.00");
    await page.getByLabel(/vencimento/i).fill(futureDateIso());
    const postResp = await Promise.all([
      waitForApi(page, "/v1/portal/cobrancas", "POST"),
      page.getByRole("button", { name: /criar cobrança/i }).click()
    ]).then(([r]) => r);
    expect(postResp.status()).toBe(201);

    await page.goto("/cobrancas");
    await expect(page.getByText(ref)).toBeVisible({ timeout: 15_000 });
  });

  test(bddTitle("Nova cobrança", "Nova cobrança a partir do cliente"), async ({ page }) => {
    await page.goto("/clientes");
    await expect(page.getByRole("heading", { name: /clientes/i })).toBeVisible();
    const detalheHref = await page.locator('table tbody a[href^="/clientes/"]').first().getAttribute("href");
    test.skip(!detalheHref || detalheHref.includes("/novo"), "Sem clientes na lista");
    const clienteId = detalheHref!.split("/").filter(Boolean).pop()!;
    await page.goto(`/cobrancas/nova?clienteId=${encodeURIComponent(clienteId)}`);
    await expect(page).toHaveURL(/\/cobrancas\/nova\?clienteId=/);
    const select = page.locator('select').filter({ has: page.locator('option:not([value=""])') });
    const value = await select.inputValue();
    expect(value.length).toBeGreaterThan(0);
  });
});
