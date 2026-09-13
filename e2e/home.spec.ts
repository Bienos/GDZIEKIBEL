import { expect, test } from '@playwright/test';

/**
 * TASK-001 smoke test only: the home page loads and carries the GdzieKibel.pl
 * identity. Product-flow E2E coverage belongs to later tasks.
 */
test('home page loads with the GdzieKibel.pl identity', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle(/GdzieKibel\.pl/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('GdzieKibel.pl');
});
