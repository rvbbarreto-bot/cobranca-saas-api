import { bddTitle } from "../reporters/evidence-reporter";
import { waitForApi } from "../helpers/api-response";
import { uniqueTestCnpj } from "../helpers/br-doc";
import { test, expect } from "../fixtures/test";

test.describe("Clientes", () => {
  test(bddTitle("Clientes", "Listar clientes"), async ({ page }) => {
    const listResp = await Promise.all([
      waitForApi(page, "/v1/portal/clientes", "GET"),
      page.goto("/clientes")
    ]).then(([r]) => r);
    expect(listResp.status()).toBe(200);
    await expect(page.getByRole("heading", { name: /clientes/i })).toBeVisible();
  });

  test(bddTitle("Clientes", "Criar cliente"), async ({ page, net }) => {
    const nome = `Cliente QA ${Date.now()}`;
    await page.goto("/clientes/novo");
    await page.getByLabel(/cpf \/ cnpj/i).fill(uniqueTestCnpj(Date.now()));
    await page.getByLabel(/razão social/i).fill(nome);
    await page.getByLabel(/^e-mail$/i).fill(`qa-${Date.now()}@test.local`);
    const postResp = await Promise.all([
      waitForApi(page, "/v1/portal/clientes", "POST"),
      page.locator("form").getByRole("button", { name: /^salvar$/i }).click()
    ]).then(([r]) => r);
    expect(postResp.status()).toBe(201);
    await page.goto("/clientes");
    await expect(page.getByText(nome)).toBeVisible({ timeout: 15_000 });
  });

  test(bddTitle("Clientes", "Editar cliente sem alterar documento"), async ({ page, net }) => {
    const baseNome = `Cliente QA ${Date.now()}`;
    await page.goto("/clientes/novo");
    await page.getByLabel(/cpf \/ cnpj/i).fill(uniqueTestCnpj(Date.now() + 1));
    await page.getByLabel(/razão social/i).fill(baseNome);
    await page.getByLabel(/^e-mail$/i).fill(`qa-edit-${Date.now()}@test.local`);
    const postResp = await Promise.all([
      waitForApi(page, "/v1/portal/clientes", "POST"),
      page.locator("form").getByRole("button", { name: /^salvar$/i }).click()
    ]).then(([r]) => r);
    expect(postResp.status()).toBe(201);
    const created = (await postResp.json()) as { cliente?: { id?: string } };
    const clienteId = created.cliente?.id;
    test.skip(!clienteId, "POST clientes não devolveu cliente.id");

    await page.goto(`/clientes/${clienteId}/editar`);
    await expect(page.getByRole("heading", { name: /edição do cliente/i })).toBeVisible();
    const novoNome = `Cliente QA Edit ${Date.now()}`;
    await page.getByLabel(/razão social/i).fill(novoNome);
    const patchResp = await Promise.all([
      waitForApi(page, "/v1/portal/clientes/", "PATCH"),
      page.getByRole("button", { name: /^salvar$/i }).click()
    ]).then(([r]) => r);
    expect(patchResp.status()).toBe(200);
  });
});
