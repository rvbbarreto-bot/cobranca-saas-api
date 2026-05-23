import { bddTitle } from "../reporters/evidence-reporter";
import { clearPortalSession, loginPortal } from "../helpers/portal-auth";
import { SEED_EMAIL, SEED_PASSWORD, SEED_TENANT } from "../helpers/constants";
import { waitForApi } from "../helpers/api-response";
import { test, expect } from "../fixtures/test";

test.describe("Login do portal", () => {
  test(bddTitle("Login do portal", "Login válido redireciona para área autenticada"), async ({ page, net }) => {
    await clearPortalSession(page);
    await page.goto("/login");
    await page.locator("#login-email").fill(SEED_EMAIL);
    await page.locator("#login-tenant").fill(SEED_TENANT);
    await page.locator("#login-password").fill(SEED_PASSWORD);
    await page.getByRole("button", { name: /entrar no portal/i }).click();
    await page.waitForURL(/\/(dashboard|cobrancas|escritorio)/, { timeout: 15_000 });

    const loginRes = net.lastResponse("/v1/portal/auth/login", "POST");
    expect(loginRes?.status).toBe(200);
    expect(net.consoleErrors.filter((e) => /failed|error/i.test(e) && !/favicon/i.test(e))).toHaveLength(0);
  });

  test(bddTitle("Login do portal", "Login inválido exibe erro"), async ({ page, net }) => {
    await clearPortalSession(page);
    await page.goto("/login");
    await page.locator("#login-email").fill(SEED_EMAIL);
    await page.locator("#login-tenant").fill(SEED_TENANT);
    await page.locator("#login-password").fill("senha-invalida-xyz");
    const loginResp = await Promise.all([
      waitForApi(page, "/v1/portal/auth/login", "POST"),
      page.getByRole("button", { name: /entrar no portal/i }).click()
    ]).then(([r]) => r);

    await expect(page).toHaveURL(/\/login/);
    expect(loginResp.status()).toBeGreaterThanOrEqual(401);
    expect(loginResp.status()).toBeLessThanOrEqual(403);
  });

  test(bddTitle("Login do portal", "Rota protegida sem sessão"), async ({ page }) => {
    await clearPortalSession(page);
    await page.goto("/cobrancas");
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});
