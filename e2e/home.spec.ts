import { expect, test } from '@playwright/test';

/**
 * TASK-005 smoke test: the home page loads with the GdzieKibel.pl identity
 * and the map shell's fallback state, since no environment available to this
 * suite holds a real MapTiler key (see docs/adr/0005-map-tile-provider.md).
 * A live-tile smoke test belongs wherever a key is actually configured.
 */
test('the bare domain serves the Polish shell with the map fallback state', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/pl$/);
  await expect(page).toHaveTitle(/GdzieKibel\.pl/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('GdzieKibel.pl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'pl');

  // No key is configured in this suite's environment, so the map shell must
  // show the literal fallback rather than a blank or broken area.
  await expect(page.getByText('COŚ SIĘ WYSRAŁO.')).toBeVisible();
  await expect(page.getByText('Nie udało się załadować mapy.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'SPRÓBUJ JESZCZE RAZ' })).toBeVisible();
});

test('the switch changes every string and the lang attribute, map fallback included', async ({
  page,
}) => {
  await page.goto('/pl');
  await page.getByRole('link', { name: 'English' }).click();

  await expect(page).toHaveURL(/\/en$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByText('Project foundation')).toBeVisible();
  await expect(page.getByText('Something went wrong.')).toBeVisible();
  await expect(page.getByText('The map could not load.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'TRY AGAIN' })).toBeVisible();
  await expect(page.getByText('COŚ SIĘ WYSRAŁO.')).toHaveCount(0);

  // and back again
  await page.getByRole('link', { name: 'Polski' }).click();
  await expect(page).toHaveURL(/\/pl$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'pl');
});
