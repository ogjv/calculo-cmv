import { test, expect } from '@playwright/test';

test('local login shows multiple restaurants and preserves selection on reload', async ({ page, baseURL }) => {
  // Prepare a local session with two restaurants
  const session = {
    userId: 'test-user',
    email: 'conta.teste@example.com',
    authMode: 'local',
    userFullName: 'Conta Teste',
    globalRole: 'user',
    memberships: [
      {
        membershipId: 'm-1',
        accountId: 'acc-1',
        restaurantId: 'r-katzsu',
        restaurantName: 'KatzSu',
        role: 'viewer'
      },
      {
        membershipId: 'm-2',
        accountId: 'acc-1',
        restaurantId: 'r-nosso-ipanema',
        restaurantName: 'Nosso Ipanema',
        role: 'viewer'
      }
    ],
    activeRole: 'viewer',
    activeRestaurantId: 'r-katzsu',
    activeRestaurantName: 'KatzSu'
  };

  // Inject session into localStorage before the app loads
  await page.addInitScript((sessionStr) => {
    const key = 'grest.auth.session';
    try {
      localStorage.setItem(key, sessionStr);
    } catch (e) {
      // noop
    }
  }, JSON.stringify(session));

  // Go to the app root
  await page.goto('/');

  // Wait for restaurant navigator header to appear
  await expect(page.locator('h3', { hasText: 'Seus restaurantes' })).toBeVisible({ timeout: 30_000 });

  // Verify both restaurants are visible inside the navigator
  const katzTile = page.locator('.restaurant-navigator-grid .restaurant-tile:has-text("KatzSu")');
  const ipanemaTile = page.locator('.restaurant-navigator-grid .restaurant-tile:has-text("Nosso Ipanema")');
  await expect(katzTile).toBeVisible();
  await expect(ipanemaTile).toBeVisible();

  // Click the second restaurant tile and verify it becomes active
  await ipanemaTile.click();
  const activeIpanema = page.locator('.restaurant-navigator-grid .restaurant-tile.active:has-text("Nosso Ipanema")');
  await expect(activeIpanema).toBeVisible();

  // Reload and ensure selection persists (active tile is still the selected one)
  await page.reload();
  await expect(page.locator('.restaurant-navigator-grid .restaurant-tile.active:has-text("Nosso Ipanema")')).toBeVisible();
});
