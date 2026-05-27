import path from "node:path";
import { test, expect } from "@playwright/test";

const E2E_EMAIL = process.env.E2E_USER_EMAIL;
const E2E_PASSWORD = process.env.E2E_USER_PASSWORD;
const REQUIRE_AUTH = !!(E2E_EMAIL && E2E_PASSWORD);

async function login(page: import("@playwright/test").Page) {
  if (!E2E_EMAIL || !E2E_PASSWORD) {
    test.skip(true, "Missing E2E_USER_EMAIL / E2E_USER_PASSWORD.");
  }

  await page.goto("/login");
  await page.getByLabel("Email").fill(E2E_EMAIL!);
  await page.getByLabel("Contraseña").fill(E2E_PASSWORD!);
  await page.getByRole("button", { name: "Iniciar Sesión" }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
}

test("@smoke landing/login renders", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByText("Iniciar Sesión").first()).toBeVisible();
  await expect(page.locator("#email")).toBeVisible();
  await expect(page.locator("#password")).toBeVisible();
});

test.describe("@smoke authenticated flow", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!REQUIRE_AUTH, "Missing E2E credentials for authenticated smoke flow.");
    await login(page);
  });

  test("@smoke auth -> dashboard available", async ({ page }) => {
    await expect(page.getByText("Dashboard", { exact: false }).first()).toBeVisible();
  });

  test("@smoke documents list page is reachable", async ({ page }) => {
    await page.goto("/documents");
    await expect(page.getByRole("heading", { name: "Documentos" })).toBeVisible();
  });

  test("@smoke detail dialog opens from documents table", async ({ page }) => {
    await page.goto("/documents");
    const rows = page.locator("tbody tr");
    test.skip((await rows.count()) === 0, "No documents available for detail smoke check.");

    await rows.first().getByRole("button", { name: "Ver detalle" }).click();
    await expect(page.getByText("Detalle completo del documento procesado")).toBeVisible();
    await page.keyboard.press("Escape");
  });

  test("@smoke upload and delete document", async ({ page }) => {
    await page.goto("/documents");
    const filename = "placeholder.jpg";
    const fixturePath = path.resolve(__dirname, "../../public/placeholder.jpg");

    await page.getByRole("button", { name: "Subir Documento" }).click();
    await page.locator('input[type="file"]').setInputFiles(fixturePath);
    await page.getByRole("button", { name: /Subir y Procesar|Subir a cola/ }).click();

    // Give backend processing some time and then refresh documents list.
    await page.waitForTimeout(10_000);
    await page.goto("/documents");

    const row = page.locator("tbody tr", { hasText: filename }).first();
    await expect(row).toBeVisible({ timeout: 30_000 });

    page.once("dialog", (dialog) => dialog.accept());
    await row.getByRole("button", { name: "Eliminar" }).click();

    await expect(page.getByText("Documento eliminado")).toBeVisible({ timeout: 15_000 });
  });
});
