import { test as setup } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { loginPortal } from "./helpers/portal-auth";

const authFile = join(process.cwd(), "e2e/.auth/user.json");

setup("autenticar seed portal", async ({ page }) => {
  mkdirSync(dirname(authFile), { recursive: true });
  await loginPortal(page);
  await page.context().storageState({ path: authFile });
});
