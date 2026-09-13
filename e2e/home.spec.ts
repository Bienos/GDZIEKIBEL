import { expect, test } from '@playwright/test';

/**
 * TASK-005/006 smoke tests: the home page loads with the GdzieKibel.pl
 * identity, the map shell's tile fallback state (since no environment
 * available to this suite holds a real MapTiler key — see
 * docs/adr/0005-map-tile-provider.md), and the location permission flow.
 *
 * The permission ask appears independent of tile state (see MapShell.tsx),
 * so its skip/deny/grant paths are fully testable here even though live
 * tiles are not. A live-tile smoke test belongs wherever a key is
 * configured.
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

test('the location permission ask appears on load and can be skipped', async ({ page }) => {
  await page.goto('/pl');

  const heading = page.getByRole('heading', { name: 'POZWÓL NAM ZNALEŹĆ KIBEL.' });
  await expect(heading).toBeVisible();
  await expect(
    page.getByText('Bez lokalizacji pokażemy Ci Warszawę.', { exact: false }),
  ).toBeVisible();
  await expect(page.getByText('Używamy lokalizacji tylko po to', { exact: false })).toBeVisible();
  // The ask never mimics an OS dialog, but it is real dialog-role content a
  // screen reader can reach, and focus moves to it (DESIGN.md 14).
  await expect(heading).toBeFocused();

  await page.getByRole('button', { name: 'NIE TERAZ' }).click();

  await expect(page.getByRole('heading', { name: 'POZWÓL NAM ZNALEŹĆ KIBEL.' })).toHaveCount(0);
  // Dismissing reveals whatever the map area already shows underneath — in
  // this suite's environment, the tile fallback.
  await expect(page.getByText('COŚ SIĘ WYSRAŁO.')).toBeVisible();
});

test('a denied, unavailable, or timed-out location shows the one shared screen', async ({
  page,
}) => {
  // Hand-mocked rather than relying on Playwright's permission automation
  // defaults, so the denied path is deterministic regardless of browser
  // configuration. Runs before any page script, so the app's own call to
  // getCurrentPosition is the one that receives this.
  await page.addInitScript(() => {
    Object.defineProperty(window.navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (_success: PositionCallback, error?: PositionErrorCallback) => {
          error?.({
            code: 1,
            message: 'User denied Geolocation',
            PERMISSION_DENIED: 1,
            POSITION_UNAVAILABLE: 2,
            TIMEOUT: 3,
          } as GeolocationPositionError);
        },
      },
    });
  });

  await page.goto('/pl');
  await page.getByRole('button', { name: 'UDOSTĘPNIJ LOKALIZACJĘ' }).click();

  const deniedHeading = page.getByRole('heading', { name: 'NIE WIEMY, GDZIE JESTEŚ.' });
  await expect(deniedHeading).toBeVisible();
  await expect(
    page.getByText('Bez lokalizacji możemy pokazać tylko ogólną mapę Warszawy.'),
  ).toBeVisible();
  await expect(deniedHeading).toBeFocused();

  await page.getByRole('button', { name: 'OTWÓRZ MAPĘ WARSZAWY' }).click();
  await expect(deniedHeading).toHaveCount(0);
});

test.describe('with a real browser location grant', () => {
  test.use({
    permissions: ['geolocation'],
    geolocation: { latitude: 52.2297, longitude: 21.0122 },
  });

  test('a granted location dismisses the ask, even with no map to place it on', async ({
    page,
  }) => {
    await page.goto('/pl');
    await page.getByRole('button', { name: 'UDOSTĘPNIJ LOKALIZACJĘ' }).click();

    await expect(page.getByRole('heading', { name: 'POZWÓL NAM ZNALEŹĆ KIBEL.' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'NIE WIEMY, GDZIE JESTEŚ.' })).toHaveCount(0);
    // Coordinates are never sent anywhere in this task; nothing to assert
    // beyond the sheet correctly leaving the "asking" state.
  });
});
