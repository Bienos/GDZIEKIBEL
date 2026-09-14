import { expect, test } from '@playwright/test';

/**
 * TASK-005/006/008/010/011/012/013/015/016/017/018/020/023/025/026 smoke
 * tests: the home page loads with the GdzieKibel.pl identity, the map
 * shell's tile fallback state (this suite's sandboxed environment has no
 * egress to OpenFreeMap's real tile host — see
 * docs/adr/0024-openfreemap-tile-provider.md, which replaced the earlier
 * key-gated MapTiler setup in docs/adr/0005-map-tile-provider.md), that
 * maplibre-gl's own stylesheet still never ships inside the page's global
 * CSS bundle even though it is now always attempted (TASK-025,
 * docs/adr/0020-lazy-load-map-library-styles.md), the
 * location permission flow, the nearby-toilets fetch, the nearest-toilet
 * preview, the toilet detail sheet it opens into, that sheet's navigation
 * CTA, a real (non-`UNKNOWN`) opening status rendering its own label and
 * colour, the map/list toggle, the filter sheet sending real filters in
 * the nearby request, the no-results overlay's three diagnosed states, a
 * real location grant from outside Warsaw showing its own distinct screen,
 * the report flow, that a client-only analytics event actually reaches
 * `/api/analytics/events` with the expected event name, and that every
 * sheet's `role="dialog"` resolves by its own real accessible name — not
 * just "dialog" alone (TASK-026, docs/adr/0021-accessible-dialog-names-and-contrast.md).
 *
 * The permission ask, the fetch, the preview, and the detail sheet all
 * appear independent of tile state (see MapShell.tsx), so they are fully
 * testable here even though live tiles are not. Marker-click selection is
 * not covered: this environment cannot render real markers either. The
 * navigation CTA's `href` is asserted directly rather than followed: this
 * environment has no egress to google.com (see
 * docs/adr/0008-external-navigation-url.md). A live-tile smoke test,
 * including marker clicks, belongs wherever this suite's own egress
 * restriction does not apply.
 */
test('the bare domain serves the Polish shell with the map fallback state', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/pl$/);
  await expect(page).toHaveTitle(/GdzieKibel\.pl/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('GdzieKibel.pl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'pl');

  // OpenFreeMap needs no key, so the map shell always attempts a real load;
  // this suite's own sandboxed environment cannot reach the real tile host,
  // so that attempt fails and the map shell must show the literal fallback
  // rather than a blank or broken area — the same behaviour a real
  // deployment needs for any genuine network/provider failure.
  await expect(page.getByText('COŚ SIĘ WYSRAŁO.')).toBeVisible();
  await expect(page.getByText('Nie udało się załadować mapy.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'SPRÓBUJ JESZCZE RAZ' })).toBeVisible();
});

test('maplibre-gl and its stylesheet are attempted, and still never ship inside the page itself (TASK-025, docs/adr/0024)', async ({
  page,
}) => {
  // Chunk filenames are content-hashed, so a URL substring check would
  // prove nothing; the real invariant is that maplibre-gl's own
  // `.maplibregl-*` class prefix only ever shows up in a stylesheet
  // fetched after the initial page load, never in one the server-rendered
  // HTML itself links (globals.css's own compiled output). The navigation
  // response's own raw body is the one place that distinguishes the two:
  // by the time `goto()` resolves, any client-injected `<link>` tag from
  // the map shell's effect is already in the live DOM too.
  const cssContainingMaplibre: string[] = [];
  page.on('response', async (response) => {
    const url = response.url();
    if (!url.endsWith('.css')) return;
    const body = await response.text().catch(() => '');
    if (body.includes('.maplibregl-')) cssContainingMaplibre.push(url);
  });

  const documentResponse = await page.goto('/pl');
  const initialHtml = (await documentResponse?.text()) ?? '';
  const initialStylesheetHrefs = [
    ...initialHtml.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]*href=["']([^"']+)["']/g),
  ]
    .map((match) => match[1])
    .filter((href): href is string => href !== undefined);

  // The map shell's own effect runs on mount; the fallback appearing proves
  // the real load was attempted and failed (this suite's sandboxed
  // environment has no egress to the real tile host), by which point any
  // dynamically-imported CSS has already been requested.
  await expect(page.getByText('COŚ SIĘ WYSRAŁO.')).toBeVisible();

  expect(cssContainingMaplibre.length).toBeGreaterThan(0);
  for (const url of cssContainingMaplibre) {
    const path = new URL(url).pathname;
    expect(initialStylesheetHrefs.some((href) => href.includes(path))).toBe(false);
  }
});

test('a hung tile load falls back after MAP_LOAD_TIMEOUT_MS instead of hanging forever, even with no error event', async ({
  page,
}) => {
  // Fake timers, not a real 15-second wait: `page.clock` replaces
  // `setTimeout` before navigation, then `fastForward` fires the pending
  // one deterministically once the page has otherwise finished loading.
  await page.clock.install();

  // Intercepted and never settled — no `fulfill`, `abort`, or `continue` —
  // so MapLibre's own style fetch never resolves or rejects and neither
  // `load` nor `error` ever fires. That is the real-device symptom
  // (iOS Safari; no console error; the map area never resolves either way)
  // that `MAP_LOAD_TIMEOUT_MS` in MapShell.tsx mitigates; it is distinct
  // from this suite's own sandboxed lack of egress, which instead produces
  // a fast `error` (the path the other tests above exercise).
  await page.route('https://tiles.openfreemap.org/**', () => {});

  await page.goto('/pl');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('GdzieKibel.pl');

  // Well before the timeout: the load attempt is still hanging, so neither
  // the map nor the fallback has resolved either way yet.
  await expect(page.getByText('COŚ SIĘ WYSRAŁO.')).not.toBeVisible();

  await page.clock.fastForward(15_000);

  await expect(page.getByText('COŚ SIĘ WYSRAŁO.')).toBeVisible();
});

test('the tile worker actually starts: a loadable style requests tiles, finishes loading, and renders fetched toilets as markers (docs/adr/0026)', async ({
  page,
}) => {
  // The worker exists to fetch tiles, so a tile request is direct proof it
  // booted; a marker is proof `load` then fired, since MapShell adds markers
  // only once it has (`mapReady`). Without the explicit worker URL
  // (docs/adr/0026-maplibre-worker-static-asset.md) the bundled default
  // resolves to nothing usable: the style and TileJSON still load, controls
  // and attribution still appear, but no tile is ever requested and `load`
  // never fires — the live site's blank map. The style is this test's own:
  // a vector source whose tiles this test answers with 404, which MapLibre
  // treats as "no tile here" rather than an error, so `load` fires exactly
  // when a worker has made the request and reported back.
  const tileUrlPrefix = 'https://tiles.openfreemap.org/__test-tiles__/';
  const cors = { 'access-control-allow-origin': '*' };
  await page.route('https://tiles.openfreemap.org/**', (route) => {
    if (route.request().url().startsWith(tileUrlPrefix)) {
      return route.fulfill({ status: 404, headers: cors, body: '' });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: cors,
      body: JSON.stringify({
        version: 8,
        sources: {
          test: { type: 'vector', tiles: [`${tileUrlPrefix}{z}/{x}/{y}.pbf`], maxzoom: 14 },
        },
        layers: [
          { id: 'background', type: 'background', paint: { 'background-color': '#ffffff' } },
          {
            id: 'water',
            type: 'fill',
            source: 'test',
            'source-layer': 'water',
            paint: { 'fill-color': '#000000' },
          },
        ],
      }),
    });
  });
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

  const firstTileRequest = page.waitForRequest((request) =>
    request.url().startsWith(tileUrlPrefix),
  );
  await page.goto('/pl');
  await page.getByRole('button', { name: 'NIE TERAZ' }).click();

  expect((await firstTileRequest).url()).toMatch(/\/\d+\/\d+\/\d+\.pbf$/);
  // The marker's accessible name is buildMarkerLabel's "<name>, <metres> m";
  // the bottom preview's is different, so this cannot match that instead.
  await expect(page.getByRole('button', { name: 'Toaleta Testowa, 240 m' })).toBeVisible();
  await expect(page.getByText('COŚ SIĘ WYSRAŁO.')).toHaveCount(0);
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
  // screen reader can reach, and focus moves to it (DESIGN.md 14). Named by
  // its own heading via aria-labelledby (TASK-026, ADR 0021), not just
  // "dialog" alone.
  await expect(heading).toBeFocused();
  await expect(page.getByRole('dialog', { name: 'POZWÓL NAM ZNALEŹĆ KIBEL.' })).toBeVisible();

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
  // Named by its own heading (TASK-026, ADR 0021), not just "dialog" alone.
  await expect(page.getByRole('dialog', { name: 'NIE WIEMY, GDZIE JESTEŚ.' })).toBeVisible();

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
    // Named by its own heading (TASK-026, ADR 0021), not just "dialog" alone.
    await expect(page.getByRole('dialog', { name: 'JESTEŚ POZA WARSZAWĄ.' })).toBeVisible();

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

  // Named by its own heading (the toilet's name) via aria-labelledby
  // (TASK-026, ADR 0021), not just "dialog" alone.
  const sheet = page.getByRole('dialog', { name: 'Toaleta Testowa' });
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

const REPORT_TEST_TOILET = {
  id: '33333333-3333-4333-8333-333333333333',
  name: 'Toaleta Zgłoszeniowa',
  lat: 52.2297,
  lng: 21.0122,
  distanceMeters: 150,
  approxWalkingMinutes: 2,
  openingStatus: 'UNKNOWN',
  priceState: 'unknown',
  priceAmountMinor: null,
  currency: null,
  confidenceLevel: 'low',
  accessType: 'unknown',
  features: { wheelchair: 'unknown', changingTable: 'unknown', unisex: 'unknown' },
  paymentMethods: { cash: 'unknown', cards: 'unknown', coins: 'unknown' },
};

async function openReportTestDetailSheet(page: import('@playwright/test').Page) {
  await page.route('**/api/toilets/nearby', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ results: [REPORT_TEST_TOILET] }),
    }),
  );

  await page.goto('/pl');
  await page.getByRole('button', { name: 'NIE TERAZ' }).click();
  await page
    .getByRole('button', { name: `Otwórz szczegóły toalety: ${REPORT_TEST_TOILET.name}` })
    .click();
  await expect(page.getByRole('heading', { name: REPORT_TEST_TOILET.name })).toBeVisible();
}

test('the report control opens the report sheet, and a successful submission shows the success copy (TASK-020)', async ({
  page,
}) => {
  const requestBodies: unknown[] = [];
  await page.route(`**/api/toilets/${REPORT_TEST_TOILET.id}/reports`, async (route) => {
    requestBodies.push(route.request().postDataJSON());
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, reportId: '44444444-4444-4444-4444-444444444444' }),
    });
  });

  await openReportTestDetailSheet(page);

  await page.getByRole('button', { name: 'ZGŁOŚ PROBLEM' }).click();

  const heading = page.getByRole('heading', { name: 'CO JEST NIE TAK?' });
  await expect(heading).toBeVisible();
  await expect(heading).toBeFocused();
  // Named by its own heading (TASK-026, ADR 0021), not just "dialog" alone.
  await expect(page.getByRole('dialog', { name: 'CO JEST NIE TAK?' })).toBeVisible();

  await page.getByRole('radio', { name: 'Godziny są złe' }).check();
  await page.getByLabel('Szczegóły (opcjonalnie)').fill('Zamknięte już o 20');
  await page.getByRole('button', { name: 'WYŚLIJ ZGŁOSZENIE' }).click();

  await expect(page.getByText('DZIĘKI. SPRAWDZIMY.')).toBeVisible();
  expect(requestBodies).toEqual([{ issueType: 'wrong_hours', note: 'Zamknięte już o 20' }]);

  // Closing from the success state returns to the toilet's own detail
  // sheet, not all the way back to the map (ReportSheet's onClose scopes
  // to ToiletDetailSheet's local reportOpen state).
  await page.getByRole('button', { name: 'ZAMKNIJ' }).click();
  await expect(page.getByRole('heading', { name: REPORT_TEST_TOILET.name })).toBeVisible();
});

test('a failed report submission shows a literal failure message and lets the user retry without losing their input (TASK-020)', async ({
  page,
}) => {
  let attempt = 0;
  await page.route(`**/api/toilets/${REPORT_TEST_TOILET.id}/reports`, async (route) => {
    attempt += 1;
    if (attempt === 1) {
      await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
      return;
    }
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, reportId: '55555555-5555-5555-5555-555555555555' }),
    });
  });

  await openReportTestDetailSheet(page);
  await page.getByRole('button', { name: 'ZGŁOŚ PROBLEM' }).click();

  const reason = page.getByRole('radio', { name: 'Nie istnieje' });
  await reason.check();
  await page.getByRole('button', { name: 'WYŚLIJ ZGŁOSZENIE' }).click();

  await expect(page.getByText('Nie udało się wysłać zgłoszenia.')).toBeVisible();
  const retry = page.getByRole('button', { name: 'SPRÓBUJ PONOWNIE' });
  await expect(retry).toBeVisible();
  await expect(reason).toBeChecked();

  await retry.click();

  await expect(page.getByText('DZIĘKI. SPRAWDZIMY.')).toBeVisible();
  expect(attempt).toBe(2);
});

test('client-triggered events reach the analytics endpoint (TASK-023)', async ({ page }) => {
  const eventNames: string[] = [];
  await page.route('**/api/analytics/events', async (route) => {
    const body = route.request().postDataJSON() as { eventName: string };
    eventNames.push(body.eventName);
    await route.fulfill({ status: 201, contentType: 'application/json', body: '{}' });
  });

  await openReportTestDetailSheet(page);
  await expect.poll(() => eventNames).toContain('app_opened');
  await expect.poll(() => eventNames).toContain('toilet_selected');

  const navigateLink = page.getByRole('dialog').getByRole('link', { name: 'PROWADŹ MNIE' });
  await navigateLink.click({ noWaitAfter: true });

  await expect.poll(() => eventNames).toContain('navigation_clicked');
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
  // Named by its own heading (TASK-026, ADR 0021), not just "dialog" alone.
  await expect(page.getByRole('dialog', { name: 'FILTRY' })).toBeVisible();
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
