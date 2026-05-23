import type { Page, Response } from "@playwright/test";

/** Aguarda resposta da API (via proxy Vite ou direta). */
export async function waitForApi(
  page: Page,
  pathPart: string,
  method: string
): Promise<Response> {
  return page.waitForResponse(
    (res) => {
      try {
        const u = new URL(res.url());
        return u.pathname.includes(pathPart) && res.request().method() === method;
      } catch {
        return res.url().includes(pathPart) && res.request().method() === method;
      }
    },
    { timeout: 20_000 }
  );
}
