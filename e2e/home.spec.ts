import { expect, test } from '@playwright/test';

/**
 * TASK-005/006/008/010/011/012/013/015/016/017/018 smoke tests: the home
 * page loads with the GdzieKibel.pl identity, the map shell's tile
 * fallback state (since no environment available to this suite holds a
 * real MapTiler key — see docs/adr/0005-map-tile-provider.md), the
 * location permission flow, the nearby-toilets fetch, the nearest-toilet
 * preview, the toilet detail sheet it opens into, that sheet's navigation
 * CTA, a real (non-`UNKNOWN`) opening status rendering its own label and
 * colour, the map/list toggle, the filter sheet sending real filters in
 * the nearby request, the no-results overlay's three diagnosed states, and
 * a real location grant from outside Warsaw showing its own distinct
 * screen.
 *
 * The permission ask, the fetch, the preview, and the detail sheet all
 * appear independent of tile state (see MapShell.tsx), so they are fully
 * testable here even though live tiles are not. Marker-click selection is
 * not covered: this environment cannot render real markers either. The
 * navigation CTA's `href` is asserted directly rather than followed: this
 * environment has no egress to google.com (see
 * docs/adr/0008-external-navigation-url.md). A live-tile smoke test,
 * including marker clicks, belongs wherever a key is
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
  // Deliberately not the default Warsaw centre, so a test can tell the
  // mount-time fetch and the post-grant refetch apart by their coordinates.
  const GRANTED_LOCATION = { latitude: 52.25, longitude: 21.05 };
  test.use({ permissions: ['geolocation'], geolocation: GRANTED_LOCATION });

  test('a granted location dismisses the ask, even with no map to place it on', async ({
    page,
  }) => {
    await page.route('**/api/toilets/nearby', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{"results":[]}' }),
    );

    await page.goto('/pl');
    await page.getByRole('button', { name: 'UDOSTĘPNIJ LOKALIZACJĘ' }).click();

    await expect(page.getByRole('heading', { name: 'POZWÓL NAM ZNALEŹĆ KIBEL.' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'NIE WIEMY, GDZIE JESTEŚ.' })).toHaveCount(0);
  });

  test('a granted location re-queries nearby toilets centred on the real position', async ({
    page,
  }) => {
    const requestBodies: unknown[] = [];
    await page.route('**/api/toilets/nearby', async (route) => {
      requestBodies.push(route.request().postDataJSON());
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"results":[]}' });
    });

    await page.goto('/pl');
    // TASK-008's mount-time fetch, centred on the default Warsaw view.
    await expect.poll(() => requestBodies.length).toBeGreaterThanOrEqual(1);
    expect(requestBodies[0]).toEqual({ location: { lat: 52.2297, lng: 21.0122 } });

    await page.getByRole('button', { name: 'UDOSTĘPNIJ LOKALIZACJĘ' }).click();

    // A second request, centred on the granted coordinates, distinct from
    // the first request's default Warsaw centre.
    await expect.poll(() => requestBodies.length).toBeGreaterThanOrEqual(2);
    expect(requestBodies.at(-1)).toEqual({
      location: { lat: GRANTED_LOCATION.latitude, lng: GRANTED_LOCATION.longitude },
    });
    expect(requestBodies[0]).not.toEqual(requestBodies.at(-1));
  });
});

test.describe('a real browser location grant from outside Warsaw', () => {
  // Kraków, the same out-of-Warsaw fixture tests/unit/geo.test.ts already uses.
  const KRAKOW_LOCATION = { latitude: 50.0647, longitude: 19.945 };
  test.use({ permissions: ['geolocation'], geolocation: KRAKOW_LOCATION });

  test('shows a distinct screen, never the denied copy, and never sends the out-of-area coordinates (TASK-018)', async ({
    page,
  }) => {
    const requestBodies: unknown[] = [];
    await page.route('**/api/toilets/nearby', async (route) => {
      requestBodies.push(route.request().postDataJSON());
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"results":[]}' });
    });

    await page.goto('/pl');
    await page.getByRole('button', { name: 'UDOSTĘPNIJ LOKALIZACJĘ' }).click();

    const outsideHeading = page.getByRole('heading', { name: 'JESTEŚ POZA WARSZAWĄ.' });
    await expect(outsideHeading).toBeVisible();
    await expect(
      page.getByText('Szukamy kibli tylko w Warszawie — nie mamy nic w Twojej okolicy.'),
    ).toBeVisible();
    await expect(outsideHeading).toBeFocused();

    // Never the denied screen's copy, and no retry action — being outside
    // Warsaw will not change on a second attempt (docs/adr/0013).
    await expect(page.getByRole('heading', { name: 'NIE WIEMY, GDZIE JESTEŚ.' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'SPRÓBUJ PONOWNIE' })).toHaveCount(0);

    await page.getByRole('button', { name: 'OTWÓRZ MAPĘ WARSZAWY' }).click();
    await expect(outsideHeading).toHaveCount(0);

    // The out-of-area coordinates never reach the fetch: every request stays
    // centred on the default Warsaw view, exactly like a skipped/denied grant.
    await expect.poll(() => requestBodies.length).toBeGreaterThanOrEqual(1);
    for (const body of requestBodies) {
      expect(body).toEqual({ location: { lat: 52.2297, lng: 21.0122 } });
    }
  });
});

test('the mount-time nearby fetch runs even without a location grant', async ({ page }) => {
  const requestBodies: unknown[] = [];
  await page.route('**/api/toilets/nearby', async (route) => {
    requestBodies.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"results":[]}' });
  });

  await page.goto('/pl');
  await page.getByRole('button', { name: 'NIE TERAZ' }).click();

  // PRODUCT.md section 6.1: manual browse must be useful without a grant.
  await expect.poll(() => requestBodies.length).toBeGreaterThanOrEqual(1);
  expect(requestBodies[0]).toEqual({ location: { lat: 52.2297, lng: 21.0122 } });
});

test('the nearest-toilet preview shows the top-ranked result, and not before the location step resolves', async ({
  page,
}) => {
  await page.route('**/api/toilets/nearby', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        results: [
          {
            id: '11111111-1111-1111-1111-111111111111',
            name: 'Toaleta Testowa',
            lat: 52.2297,
            lng: 21.0122,
            distanceMeters: 239.6,
            approxWalkingMinutes: 4,
            openingStatus: 'UNKNOWN',
            priceState: 'free',
            confidenceLevel: 'low',
            accessType: 'public_unconditional',
            features: { wheelchair: 'unknown', changingTable: 'unknown', unisex: 'unknown' },
          },
        ],
      }),
    }),
  );

  await page.goto('/pl');

  const preview = page.getByRole('button', {
    name: 'Otwórz szczegóły toalety: Toaleta Testowa',
  });
  // Not shown while the location ask still covers the screen.
  await expect(preview).toHaveCount(0);

  await page.getByRole('button', { name: 'NIE TERAZ' }).click();

  await expect(preview).toBeVisible();
  await expect(preview.getByText('Toaleta Testowa')).toBeVisible();
  await expect(preview.getByText('240 M · ~4 MIN PIESZO')).toBeVisible();
  await expect(preview.getByText('STATUS NIEPEWNY')).toBeVisible();
  await expect(preview.getByText('ZA DARMO')).toBeVisible();
});

test('tapping the preview opens the toilet detail sheet, and closing it returns to the preview', async ({
  page,
}) => {
  await page.route('**/api/toilets/nearby', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        results: [
          {
            id: '11111111-1111-1111-1111-111111111111',
            name: 'Toaleta Testowa',
            lat: 52.2297,
            lng: 21.0122,
            distanceMeters: 239.6,
            approxWalkingMinutes: 4,
            openingStatus: 'UNKNOWN',
            priceState: 'paid',
            priceAmountMinor: 450,
            currency: 'PLN',
            confidenceLevel: 'low',
            accessType: 'public_unconditional',
            features: { wheelchair: 'yes', changingTable: 'limited', unisex: 'unknown' },
            paymentMethods: { cash: 'no', cards: 'yes', coins: 'unknown' },
          },
        ],
      }),
    }),
  );

  await page.goto('/pl');
  await page.getByRole('button', { name: 'NIE TERAZ' }).click();

  const preview = page.getByRole('button', {
    name: 'Otwórz szczegóły toalety: Toaleta Testowa',
  });
  await expect(preview).toBeVisible();
  await preview.click();

  const heading = page.getByRole('heading', { name: 'Toaleta Testowa' });
  await expect(heading).toBeVisible();
  await expect(heading).toBeFocused();
  await expect(preview).toHaveCount(0);

  const sheet = page.getByRole('dialog');
  await expect(sheet.getByText('240 M · ~4 MIN PIESZO')).toBeVisible();
  await expect(sheet.getByText('STATUS NIEPEWNY')).toBeVisible();
  await expect(sheet.getByText('4.50 PLN')).toBeVisible();
  await expect(sheet.getByText('GOTÓWKA')).toBeVisible();
  await expect(sheet.getByText('KARTA')).toBeVisible();
  await expect(sheet.getByText('MONETY')).toBeVisible();
  await expect(sheet.getByText('DOSTĘP DLA WÓZKÓW')).toBeVisible();
  await expect(sheet.getByText('PRZEWIJAK')).toBeVisible();
  await expect(sheet.getByText('OGRANICZONE')).toBeVisible();
  await expect(sheet.getByText('TOALETA UNISEX')).toBeVisible();
  await expect(sheet.getByText('PEWNOŚĆ DANYCH: NISKA')).toBeVisible();

  const navigateLink = sheet.getByRole('link', { name: 'PROWADŹ MNIE' });
  await expect(navigateLink).toHaveAttribute(
    'href',
    'https://www.google.com/maps/dir/?api=1&destination=52.2297%2C21.0122&travelmode=walking',
  );
  await expect(navigateLink).toHaveAttribute('target', '_blank');
  await expect(navigateLink).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(sheet.getByText('ZANIM BĘDZIE ZA PÓŹNO.')).toBeVisible();

  await page.getByRole('button', { name: 'ZAMKNIJ' }).click();

  await expect(sheet).toHaveCount(0);
  await expect(preview).toBeVisible();
});

test('a real OPEN status renders its own label and colour, not the uncertain one (TASK-013)', async ({
  page,
}) => {
  await page.route('**/api/toilets/nearby', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        results: [
          {
            id: '22222222-2222-2222-2222-222222222222',
            name: 'Toaleta Otwarta',
            lat: 52.2297,
            lng: 21.0122,
            distanceMeters: 100,
            approxWalkingMinutes: 2,
            openingStatus: 'OPEN',
            priceState: 'free',
            confidenceLevel: 'low',
            accessType: 'public_unconditional',
            features: { wheelchair: 'unknown', changingTable: 'unknown', unisex: 'unknown' },
          },
        ],
      }),
    }),
  );

  await page.goto('/pl');
  await page.getByRole('button', { name: 'NIE TERAZ' }).click();

  const preview = page.getByRole('button', { name: 'Otwórz szczegóły toalety: Toaleta Otwarta' });
  const statusBadge = preview.getByText('OTWARTY', { exact: true });
  await expect(statusBadge).toBeVisible();
  // --status-open (--color-status-green: #9bea88), not the uncertain orange.
  await expect(statusBadge).toHaveCSS('background-color', 'rgb(155, 234, 136)');
});

test('the list view shows the same toilet, independent of the map, and opens the same detail sheet', async ({
  page,
}) => {
  await page.route('**/api/toilets/nearby', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        results: [
          {
            id: '33333333-3333-3333-3333-333333333333',
            name: 'Toaleta Listowa',
            lat: 52.2297,
            lng: 21.0122,
            distanceMeters: 180,
            approxWalkingMinutes: 3,
            openingStatus: 'CLOSED',
            priceState: 'free',
            priceAmountMinor: null,
            currency: null,
            confidenceLevel: 'low',
            accessType: 'public_unconditional',
            features: { wheelchair: 'yes', changingTable: 'unknown', unisex: 'unknown' },
            paymentMethods: { cash: 'unknown', cards: 'unknown', coins: 'unknown' },
          },
        ],
      }),
    }),
  );

  await page.goto('/pl');
  await page.getByRole('button', { name: 'NIE TERAZ' }).click();

  // Map fallback is showing (no MapTiler key in this suite); the toggle
  // works regardless.
  await expect(page.getByText('COŚ SIĘ WYSRAŁO.')).toBeVisible();

  await page.getByRole('button', { name: 'LISTA' }).click();

  const list = page.getByRole('list', { name: 'Lista toalet w pobliżu' });
  await expect(list).toBeVisible();
  // The collapsed preview does not duplicate the list's own first row.
  await expect(
    page.getByRole('button', { name: 'Otwórz szczegóły toalety: Toaleta Listowa' }),
  ).toHaveCount(1);

  const row = list.getByRole('listitem').first();
  await expect(row.getByText('Toaleta Listowa')).toBeVisible();
  await expect(row.getByText('180 M · ~3 MIN PIESZO')).toBeVisible();
  await expect(row.getByText('ZAMKNIĘTY')).toBeVisible();
  await expect(row.getByText('ZA DARMO')).toBeVisible();
  await expect(row.getByText('DOSTĘP DLA WÓZKÓW: TAK')).toBeVisible();

  await row.getByRole('button').click();

  const heading = page.getByRole('heading', { name: 'Toaleta Listowa' });
  await expect(heading).toBeVisible();
  await expect(heading).toBeFocused();

  await page.getByRole('button', { name: 'ZAMKNIJ' }).click();
  await expect(heading).toHaveCount(0);

  await page.getByRole('button', { name: 'MAPA' }).click();
  await expect(list).toHaveCount(0);
  await expect(page.getByText('COŚ SIĘ WYSRAŁO.')).toBeVisible();
});

test('the filter sheet sends filters in the nearby request, and clear resets them (TASK-016)', async ({
  page,
}) => {
  const requestBodies: unknown[] = [];
  await page.route('**/api/toilets/nearby', async (route) => {
    requestBodies.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"results":[]}' });
  });

  await page.goto('/pl');
  await page.getByRole('button', { name: 'NIE TERAZ' }).click();

  await expect.poll(() => requestBodies.length).toBeGreaterThanOrEqual(1);
  expect(requestBodies[0]).toEqual({ location: { lat: 52.2297, lng: 21.0122 } });

  await page.getByRole('button', { name: 'FILTRY' }).click();
  await page.getByRole('checkbox', { name: 'OTWARTE TERAZ' }).check();
  await page.getByRole('button', { name: 'POKAŻ WYNIKI' }).click();

  await expect.poll(() => requestBodies.length).toBeGreaterThanOrEqual(2);
  expect(requestBodies.at(-1)).toEqual({
    location: { lat: 52.2297, lng: 21.0122 },
    filters: { openNow: true },
  });

  const dialog = page.getByRole('dialog');
  await expect(dialog).toHaveCount(0);

  // Reopening shows the currently applied filter, not a reset draft.
  await page.getByRole('button', { name: 'FILTRY' }).click();
  await expect(page.getByRole('checkbox', { name: 'OTWARTE TERAZ' })).toBeChecked();

  await page.getByRole('button', { name: 'WYCZYŚĆ' }).click();

  await expect.poll(() => requestBodies.length).toBeGreaterThanOrEqual(3);
  expect(requestBodies.at(-1)).toEqual({ location: { lat: 52.2297, lng: 21.0122 } });
  await expect(dialog).toHaveCount(0);
});

/**
 * TASK-017 / docs/adr/0012-no-results-diagnosis.md: three diagnosed causes
 * for an empty `toilets` array, checked in this order — an active filter,
 * an expandable radius, an exhausted radius — each with its own message
 * and the one action that can actually help.
 */
test('an active filter explains empty results, and clearing it re-fetches without the filter (TASK-017)', async ({
  page,
}) => {
  const requestBodies: unknown[] = [];
  await page.route('**/api/toilets/nearby', async (route) => {
    requestBodies.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"results":[]}' });
  });

  await page.goto('/pl');
  await page.getByRole('button', { name: 'NIE TERAZ' }).click();

  await page.getByRole('button', { name: 'FILTRY' }).click();
  await page.getByRole('checkbox', { name: 'OTWARTE TERAZ' }).check();
  await page.getByRole('button', { name: 'POKAŻ WYNIKI' }).click();

  await expect.poll(() => requestBodies.length).toBeGreaterThanOrEqual(2);

  const overlay = page.getByRole('status').filter({ hasText: 'NIC BLISKO.' });
  await expect(overlay).toBeVisible();
  await expect(overlay.getByText('Żaden kibel nie spełnia wybranych filtrów.')).toBeVisible();

  // The filter, not the radius, is the diagnosed cause: only one action is
  // offered, and it reuses the filter sheet's own "WYCZYŚĆ" copy/state.
  await expect(overlay.getByRole('button', { name: 'SZUKAJ DALEJ' })).toHaveCount(0);
  await overlay.getByRole('button', { name: 'WYCZYŚĆ' }).click();

  await expect.poll(() => requestBodies.length).toBeGreaterThanOrEqual(3);
  expect(requestBodies.at(-1)).toEqual({ location: { lat: 52.2297, lng: 21.0122 } });

  // No filter is active any more: the same overlay now diagnoses distance.
  await expect(overlay.getByText('W tym promieniu nie mamy nic sensownego.')).toBeVisible();
});

test('an expandable radius explains empty results, and searching farther re-fetches at the maximum radius (TASK-017)', async ({
  page,
}) => {
  const requestBodies: unknown[] = [];
  await page.route('**/api/toilets/nearby', async (route) => {
    requestBodies.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{"results":[]}' });
  });

  await page.goto('/pl');
  await page.getByRole('button', { name: 'NIE TERAZ' }).click();

  await expect.poll(() => requestBodies.length).toBeGreaterThanOrEqual(1);
  expect(requestBodies[0]).toEqual({ location: { lat: 52.2297, lng: 21.0122 } });

  const overlay = page.getByRole('status').filter({ hasText: 'NIC BLISKO.' });
  await expect(overlay).toBeVisible();
  await expect(overlay.getByText('W tym promieniu nie mamy nic sensownego.')).toBeVisible();

  await overlay.getByRole('button', { name: 'SZUKAJ DALEJ' }).click();

  // Jumps directly to the server ceiling, not a stepped ladder
  // (docs/adr/0012-no-results-diagnosis.md).
  await expect.poll(() => requestBodies.length).toBeGreaterThanOrEqual(2);
  expect(requestBodies.at(-1)).toEqual({
    location: { lat: 52.2297, lng: 21.0122 },
    radiusMeters: 5000,
  });
});

test('an exhausted radius explains empty results without implying nothing exists anywhere, and can be dismissed (TASK-017)', async ({
  page,
}) => {
  await page.route('**/api/toilets/nearby', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"results":[]}' }),
  );

  await page.goto('/pl');
  await page.getByRole('button', { name: 'NIE TERAZ' }).click();

  const overlay = page.getByRole('status').filter({ hasText: 'NIC BLISKO.' });
  await expect(overlay).toBeVisible();
  await overlay.getByRole('button', { name: 'SZUKAJ DALEJ' }).click();

  // Still empty at the maximum radius: the honest final state, naming this
  // search's own limit rather than claiming nothing exists anywhere.
  await expect(
    overlay.getByText('Nic nie znaleźliśmy nawet w najszerszym promieniu wyszukiwania.'),
  ).toBeVisible();
  const dismiss = overlay.getByRole('button', { name: 'ROZUMIEM' });
  await expect(dismiss).toBeVisible();

  await dismiss.click();
  await expect(overlay).toHaveCount(0);
});
