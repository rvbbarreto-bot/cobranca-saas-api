import { bddTitle } from "../reporters/evidence-reporter";
import { waitForApi } from "../helpers/api-response";
import { test, expect } from "../fixtures/test";

test.describe("Listagem de cobranças", () => {
  test(bddTitle("Listagem de cobranças", "Lista carrega sem erro"), async ({ page }) => {
    const listResp = await Promise.all([
      waitForApi(page, "/v1/portal/cobrancas", "GET"),
      page.goto("/cobrancas")
    ]).then(([r]) => r);
    expect(listResp.status()).toBe(200);
    await expect(page.getByRole("heading", { name: /boletos/i })).toBeVisible();
  });

  test(bddTitle("Listagem de cobranças", "Carregar mais (paginação)"), async ({ page, net }) => {
    const listResp = await Promise.all([
      waitForApi(page, "/v1/portal/cobrancas", "GET"),
      page.goto("/cobrancas")
    ]).then(([r]) => r);
    expect(listResp.status()).toBe(200);
    const firstPage = (await listResp.json()) as { next_cursor?: string | null };
    if (!firstPage.next_cursor) {
      test.skip(
        true,
        "API sem next_cursor — execute npm run seed:dev (≥55 cobranças SEED-PAG-QA-*)"
      );
    }
    await expect(page.getByRole("heading", { name: /boletos/i })).toBeVisible();
    const loadMore = page.getByRole("button", { name: /carregar mais/i });
    await expect(loadMore).toBeVisible();

    net.clear();
    await loadMore.click();
    await page.waitForTimeout(1500);

    const withCursor = net.entries.find(
      (e) => e.url.includes("/v1/portal/cobrancas") && e.url.includes("cursor=")
    );
    expect(withCursor).toBeDefined();
    expect(withCursor?.status).toBe(200);
  });
});
