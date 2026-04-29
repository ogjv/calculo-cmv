import { expect, test, type Page } from "@playwright/test";

const loginWithDemoAccount = async (page: Page) => {
  await page.goto("/");
  await page.getByLabel("E-mail").fill("ipanema@grest.com");
  await page.getByLabel("Senha").fill("123456");
  await page.getByRole("button", { name: /entrar no dashboard/i }).click();
};

test("renders the local login flow with demo hint", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("Acesso de demonstração: ipanema@grest.com | 123456")).toBeVisible();
  await expect(page.getByRole("button", { name: /entrar no dashboard/i })).toBeVisible();
});

test("logs in and shows the dashboard with restaurant data", async ({ page }) => {
  await loginWithDemoAccount(page);

  await expect(page.locator(".dashboard-shell")).toBeVisible();
  await expect(page.getByText("Olá, Nosso Ipanema!")).toBeVisible();
  await expect(page.getByText("Nosso Ipanema").first()).toBeVisible();
});

test("keeps the mobile dashboard within the viewport width", async ({ page, isMobile }) => {
  test.skip(!isMobile, "Mobile-only viewport assertion");

  await loginWithDemoAccount(page);

  const viewportFits = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth + 1
  );

  expect(viewportFits).toBe(true);
  await expect(page.locator(".dashboard-sidebar")).toBeVisible();
});
