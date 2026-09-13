import { expect, test } from '@playwright/test';

/**
 * TASK-001 smoke test: the home page loads and carries the GdzieKibel.pl
 * identity. Extended with the language switch the project owner asked for.
 * Product-flow E2E coverage belongs to later tasks.
 */
test('the bare domain serves the Polish shell', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/pl$/);
  await expect(page).toHaveTitle(/GdzieKibel\.pl/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('GdzieKibel.pl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'pl');
  await expect(page.getByText('Aplikacja jest w budowie.')).toBeVisible();
});

test('the switch changes every string and the lang attribute', async ({ page }) => {
  await page.goto('/pl');
  await page.getByRole('link', { name: 'English' }).click();

  await expect(page).toHaveURL(/\/en$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByText('This app is still being built.')).toBeVisible();
  await expect(page.getByText('Project foundation')).toBeVisible();
  await expect(page.getByText('Aplikacja jest w budowie.')).toHaveCount(0);

  // and back again
  await page.getByRole('link', { name: 'Polski' }).click();
  await expect(page).toHaveURL(/\/pl$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'pl');
});
