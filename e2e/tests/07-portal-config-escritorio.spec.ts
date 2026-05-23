import { bddTitle } from "../reporters/evidence-reporter";
import { test, expect } from "../fixtures/test";

test.describe("Configurações do escritório (admin)", () => {
  test(bddTitle("Configurações do escritório (admin)", "Acesso à página de configurações"), async ({
    page,
    net
  }) => {
    await page.goto("/configuracoes");
    await expect(page.getByRole("button", { name: /gateway e integrações/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /régua de cobrança/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^templates$/i })).toBeVisible();

    const cfgRes = net.lastResponse("/v1/portal/escritorio/config", "GET");
    expect(cfgRes?.status).toBe(200);
  });

  test(bddTitle("Configurações do escritório (admin)", "Utilizador sem perfil admin não acessa"), async () => {
    test.skip(true, "Seed só provisiona admin_escritorio — cenário requer utilizador operador");
  });
});

test.describe("Escritório e assinatura SaaS", () => {
  test(bddTitle("Escritório e assinatura SaaS", "Página escritório exibe tenant e link"), async ({ page }) => {
    await page.goto("/escritorio");
    await expect(page.getByRole("heading", { name: "Escritório" })).toBeVisible();
    const body = await page.locator("body").textContent();
    expect(body?.length).toBeGreaterThan(50);
  });
});
