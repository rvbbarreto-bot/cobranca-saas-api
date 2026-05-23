import type { Page } from "@playwright/test";
import { PORTAL_BASE, SEED_EMAIL, SEED_PASSWORD, SEED_TENANT } from "./constants";
import { waitForApi } from "./api-response";

export async function loginPortal(
  page: Page,
  opts?: { email?: string; tenant?: string; password?: string }
): Promise<void> {
  await page.goto(`${PORTAL_BASE}/login`);
  await page.locator("#login-email").fill(opts?.email ?? SEED_EMAIL);
  await page.locator("#login-tenant").fill(opts?.tenant ?? SEED_TENANT);
  await page.locator("#login-password").fill(opts?.password ?? SEED_PASSWORD);
  await Promise.all([
    waitForApi(page, "/v1/portal/auth/login", "POST"),
    page.getByRole("button", { name: /entrar no portal/i }).click()
  ]);
  await page.waitForURL(/\/(dashboard|cobrancas|escritorio|clientes)/, { timeout: 20_000 });
}

export async function clearPortalSession(page: Page): Promise<void> {
  await page.goto(`${PORTAL_BASE}/login`);
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}
