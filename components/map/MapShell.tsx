'use client';

import { useEffect, useRef, useState } from 'react';
import { reportEvent } from '@/lib/analytics/report-event';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { isWithinWarsawBbox } from '@/lib/geo/warsaw';
import { requestLocation, type LocationResult } from '@/lib/geolocation/request-location';
import { buildMapStyleUrl } from '@/lib/map/tile-provider';
import {
  WARSAW_CENTER,
  WARSAW_CENTER_LAT,
  WARSAW_CENTER_LNG,
  WARSAW_DEFAULT_ZOOM,
  WARSAW_MAX_BOUNDS,
} from '@/lib/map/warsaw-view';
import type { NearbyFilters } from '@/lib/toilets/filter-nearby';
import { fetchNearbyToilets } from '@/lib/toilets/fetch-nearby';
import { diffMarkers } from '@/lib/toilets/marker-diff';
import { createToiletMarkerElement, setMarkerSelected } from '@/lib/toilets/marker-element';
import { DEFAULT_RADIUS_METERS, MAX_RADIUS_METERS } from '@/lib/toilets/nearby-request';
import type { NearbyToiletResult } from '@/lib/toilets/nearby-response';
import { FiltersSheet } from './FiltersSheet';
import { NearestToiletPreview } from './NearestToiletPreview';
import { NoResultsState } from './NoResultsState';
import { ToiletDetailSheet } from './ToiletDetailSheet';
import { ToiletListView } from './ToiletListView';
import styles from './MapShell.module.css';

/**
 * The Warsaw map shell (TASK-005), the location permission flow (TASK-006),
 * nearby toilet markers with click-to-select (TASK-008), the collapsed
 * nearest-toilet preview (TASK-010, reading the API's now-ranked order from
 * TASK-009), the toilet detail sheet (TASK-011, opened by tapping either of
 * those or a list row), the accessible list view (TASK-015, a toggle away
 * from the map), the core filters (TASK-016), which apply to markers, the
 * list, and the preview alike since all three read the one `toilets` state
 * the filtered fetch already produced, the no-results diagnosis (TASK-017,
 * `docs/adr/0012-no-results-diagnosis.md`), which reads that same state to
 * tell an active filter apart from a genuinely thin radius, and the
 * outside-Warsaw screen (TASK-018, `docs/adr/0013-outside-warsaw-behaviour.md`),
 * which keeps a real but out-of-area grant from ever reaching any of it.
 * Reports `app_opened`/`location_granted`/`location_denied`/`toilet_selected`
 * (TASK-023, `docs/adr/0018-first-party-analytics.md`) — the funnel events
 * that only ever happen in the browser; `navigation_clicked` is reported
 * from `ToiletDetailSheet.tsx` itself, and the remaining four events are
 * logged server-side, where the request already reveals them.
 *
 * When no tile provider key is configured, `maplibre-gl`'s JS and CSS
 * (TASK-025, `docs/adr/0020-lazy-load-map-library-styles.md`) are never
 * imported or initialised. The component renders the literal fallback
 * state instead, per `docs/adr/0005-map-tile-provider.md`. This is not a
 * stub: every environment without a configured key, including a
 * misconfigured production one, needs exactly this behaviour rather than
 * a blank area.
 */

/**
 * `asking` is the initial state, not something reached via an effect: the
 * location ask appears immediately on mount, independent of whether the
 * map's own tiles have finished loading. `PRODUCT.md`'s primary journey asks
 * for location "immediately", and `DESIGN.md` sections 9.1-9.3 place the
 * permission screen before the main map screen, not after it. Granting
 * location while the map itself is in its fallback state is a real, handled
 * case: there is simply nowhere to put a dot yet.
 *
 * `denied` covers every non-grant outcome (denied, unavailable, timeout,
 * unexpected error) with the one shared screen `BRAND.md` and `DESIGN.md`
 * both give for it, rather than one screen per cause.
 *
 * `outside` is distinct from `denied` (TASK-018,
 * `docs/adr/0013-outside-warsaw-behaviour.md`): a real grant with real
 * coordinates, just outside `WARSAW_BBOX`, so `denied`'s "we don't know
 * where you are" copy would be false.
 */
type LocationFlowState = 'asking' | 'requesting' | 'granted' | 'denied' | 'outside' | 'dismissed';

/**
 * The exact inputs one fetch of the nearby-toilets effect below ran with.
 * `toiletsLoaded`/`noResultsDismissed` compare the current render's own
 * values against a `SearchParams` recorded from inside a `.then` callback
 * or a click handler — never a `setState` call placed synchronously in the
 * effect body itself, which `react-hooks/set-state-in-effect` rejects, and
 * never a ref read during render, which `react-hooks/refs` rejects. Fields
 * are compared with `===`: `coords`/`filters` are only ever replaced
 * wholesale (never mutated in place), so reference equality here means the
 * same thing the effect's own dependency array already means.
 */
interface SearchParams {
  coords: { lat: number; lon: number } | null;
  filters: NearbyFilters;
  radiusMeters: number;
}

function sameSearchParams(recorded: SearchParams | null, current: SearchParams): boolean {
  return (
    recorded !== null &&
    recorded.coords === current.coords &&
    recorded.filters === current.filters &&
    recorded.radiusMeters === current.radiusMeters
  );
}

export function MapShell({ dictionary }: { dictionary: Dictionary }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('maplibre-gl').Map | null>(null);
  const toiletMarkersRef = useRef<Map<string, import('maplibre-gl').Marker>>(new Map());
  const [tilesFailed, setTilesFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [mapReady, setMapReady] = useState(false);
  const [locationFlow, setLocationFlow] = useState<LocationFlowState>('asking');
  const [grantedCoords, setGrantedCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [toilets, setToilets] = useState<NearbyToiletResult[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [activeFilters, setActiveFilters] = useState<NearbyFilters>({});
  const [draftFilters, setDraftFilters] = useState<NearbyFilters>({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchRadius, setSearchRadius] = useState(DEFAULT_RADIUS_METERS);
  const [loadedParams, setLoadedParams] = useState<SearchParams | null>(null);
  const [dismissedParams, setDismissedParams] = useState<SearchParams | null>(null);
  const askHeadingRef = useRef<HTMLHeadingElement>(null);
  const deniedHeadingRef = useRef<HTMLHeadingElement>(null);
  const outsideHeadingRef = useRef<HTMLHeadingElement>(null);

  // NEXT_PUBLIC_ variables must be referenced literally for Next.js to inline
  // them at build time; wrapping this read in a helper would leave it empty.
  const styleUrl = buildMapStyleUrl(process.env.NEXT_PUBLIC_MAPTILER_KEY);

  useEffect(() => {
    void reportEvent('app_opened');
  }, []);

  useEffect(() => {
    if (!styleUrl || !containerRef.current) return;

    // toiletMarkersRef.current is never reassigned; it always points to the
    // same Map for the component's lifetime. Captured here anyway, at
    // effect-setup time, so the cleanup below reads a local rather than
    // `.current` directly.
    const toiletMarkers = toiletMarkersRef.current;
    let cancelled = false;
    let hasLoaded = false;
    let map: import('maplibre-gl').Map | undefined;

    // Imported dynamically so the ~200 KB library, and its ~11 KB (gzipped)
    // stylesheet, are never fetched on the fallback path (TASK-025,
    // `docs/adr/0020-lazy-load-map-library-styles.md`) — a real Lighthouse
    // run found the CSS still loading unconditionally from `globals.css`,
    // 98% unused, on every page view that never mounts a map.
    Promise.all([import('maplibre-gl'), import('maplibre-gl/dist/maplibre-gl.css')])
      .then(([{ Map: MapLibreMap, NavigationControl }]) => {
        if (cancelled || !containerRef.current) return;

        // attributionControl defaults on; MapTiler's terms require it, so it
        // is left at that default rather than disabled.
        map = new MapLibreMap({
          container: containerRef.current,
          style: styleUrl,
          center: WARSAW_CENTER,
          zoom: WARSAW_DEFAULT_ZOOM,
          maxBounds: WARSAW_MAX_BOUNDS,
        });
        map.addControl(new NavigationControl({}), 'top-right');
        map.on('load', () => {
          hasLoaded = true;
          mapRef.current = map ?? null;
          setMapReady(true);
        });
        // A single failed tile after a successful load is not fatal to the
        // shell; only failing before the map ever loads means the style or
        // key is bad, or the provider is unreachable.
        map.on('error', () => {
          if (!cancelled && !hasLoaded) setTilesFailed(true);
        });
      })
      .catch(() => {
        if (!cancelled) setTilesFailed(true);
      });

    return () => {
      cancelled = true;
      mapRef.current = null;
      setMapReady(false);
      for (const marker of toiletMarkers.values()) marker.remove();
      toiletMarkers.clear();
      map?.remove();
    };
  }, [styleUrl, attempt]);

  useEffect(() => {
    if (locationFlow === 'asking') askHeadingRef.current?.focus();
    if (locationFlow === 'denied') deniedHeadingRef.current?.focus();
    if (locationFlow === 'outside') outsideHeadingRef.current?.focus();
  }, [locationFlow]);

  // Fetches nearby toilets on mount, centred on the default Warsaw view, and
  // again whenever the user grants a real location, changes the active
  // filters (TASK-016), or expands the search radius (TASK-017). This is
  // independent of whether the map itself has loaded: PRODUCT.md section 6.1
  // requires the manual-browse journey to be useful even without a grant,
  // and an empty map with no toilets until location is shared would be a
  // weak version of that. Rendering the results as markers is a separate
  // effect below.
  //
  // `loadedParams` only changes from inside the `.then` callback, once this
  // exact search has actually finished — see `SearchParams` above for why
  // `toiletsLoaded` (derived below, at render time) is false for the
  // duration of a new search without this effect resetting anything itself.
  useEffect(() => {
    let cancelled = false;
    const center = grantedCoords ?? { lat: WARSAW_CENTER_LAT, lon: WARSAW_CENTER_LNG };
    const params: SearchParams = {
      coords: grantedCoords,
      filters: activeFilters,
      radiusMeters: searchRadius,
    };

    fetchNearbyToilets({
      lat: center.lat,
      lng: center.lon,
      filters: activeFilters,
      // Omitted at the default radius, matching the pre-TASK-017 request
      // shape; only a real expansion is worth naming explicitly.
      radiusMeters: searchRadius === DEFAULT_RADIUS_METERS ? undefined : searchRadius,
    }).then((result) => {
      if (cancelled) return;
      if (result.ok) setToilets(result.results);
      setLoadedParams(params);
    });

    return () => {
      cancelled = true;
    };
  }, [grantedCoords, activeFilters, searchRadius]);

  // Reconciles the fetched toilet list onto the map: adds a marker for a new
  // id, removes one for an id no longer present, leaves the rest alone. A
  // no-op while there is no map instance yet (no key, tiles still loading,
  // or tiles failed) — the fetch above still runs and its result is kept,
  // rendered as soon as a map becomes available.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    let cancelled = false;

    import('maplibre-gl').then(({ Marker }) => {
      if (cancelled) return;

      const diff = diffMarkers(new Set(toiletMarkersRef.current.keys()), toilets);

      for (const id of diff.toRemove) {
        toiletMarkersRef.current.get(id)?.remove();
        toiletMarkersRef.current.delete(id);
      }

      for (const toilet of diff.toAdd) {
        const element = createToiletMarkerElement(
          toilet,
          styles.toiletMarker ?? '',
          styles.toiletMarkerSelected ?? '',
          () => selectToilet(toilet.id),
        );
        const marker = new Marker({ element })
          .setLngLat({ lng: toilet.lng, lat: toilet.lat })
          .addTo(map);
        toiletMarkersRef.current.set(toilet.id, marker);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [toilets, mapReady]);

  // Keeps exactly one marker visually selected, independent of the add/remove
  // reconciliation above, since selection can change without the toilet list
  // changing.
  useEffect(() => {
    for (const [id, marker] of toiletMarkersRef.current) {
      setMarkerSelected(marker.getElement(), id === selectedId, styles.toiletMarkerSelected ?? '');
    }
  }, [selectedId, toilets]);

  async function addUserLocationMarker(result: Extract<LocationResult, { status: 'granted' }>) {
    const map = mapRef.current;
    // No map to place a dot on: the tile provider may still be loading, or
    // may have failed. The grant itself is still recorded via locationFlow.
    if (!map) return;

    const { Marker } = await import('maplibre-gl');
    const element = document.createElement('div');
    element.className = styles.locationDot ?? '';
    element.setAttribute('role', 'img');
    element.setAttribute('aria-label', dictionary.userLocationLabel);

    new Marker({ element })
      .setLngLat({ lng: result.coords.lon, lat: result.coords.lat })
      .addTo(map);
    map.easeTo({ center: [result.coords.lon, result.coords.lat], zoom: 14 });
  }

  async function handleShareLocation() {
    setLocationFlow('requesting');
    const result = await requestLocation();

    if (result.status === 'granted') {
      // The browser's own permission outcome, independent of whether the
      // coordinates turn out to be usable (TASK-023) — the outside-Warsaw
      // case below is still a real grant.
      void reportEvent('location_granted');
      // Checked before either the marker or `grantedCoords` are touched
      // (TASK-018, ADR 0013): a coordinate outside the supported area must
      // never reach the fetch/ranking/marker code that assumes a usable
      // Warsaw-area position.
      if (!isWithinWarsawBbox(result.coords)) {
        setLocationFlow('outside');
        return;
      }
      await addUserLocationMarker(result);
      setLocationFlow('granted');
      setGrantedCoords({ lat: result.coords.lat, lon: result.coords.lon });
      return;
    }

    // Every non-grant outcome (denied, unavailable, timeout, error) shares
    // one screen; BRAND.md and DESIGN.md give one copy variant for all of
    // them, not one each.
    void reportEvent('location_denied');
    setLocationFlow('denied');
  }

  /** Fires `toilet_selected` (TASK-023) once, from the one place every
   * selection path (marker, preview, list row) funnels through. */
  function selectToilet(id: string) {
    void reportEvent('toilet_selected');
    setSelectedId(id);
  }

  const selectedToilet = toilets.find((toilet) => toilet.id === selectedId) ?? null;
  const recommendedToilet = toilets[0] ?? null;
  const currentSearchParams: SearchParams = {
    coords: grantedCoords,
    filters: activeFilters,
    radiusMeters: searchRadius,
  };
  const toiletsLoaded = sameSearchParams(loadedParams, currentSearchParams);
  const noResultsDismissed = sameSearchParams(dismissedParams, currentSearchParams);
  // Never alongside the filter sheet: both are bottom-sheet-style overlays,
  // and the filter sheet's own "WYCZYŚĆ" would otherwise coexist with this
  // overlay's identical filtered-state action.
  const noResultsVisible =
    (locationFlow === 'granted' || locationFlow === 'dismissed') &&
    !filtersOpen &&
    toiletsLoaded &&
    toilets.length === 0 &&
    !noResultsDismissed;

  return (
    <div className={styles.mapWrapper}>
      {viewMode === 'list' ? (
        <ToiletListView
          toilets={toilets}
          dictionary={dictionary}
          onSelect={(id) => selectToilet(id)}
        />
      ) : !styleUrl || tilesFailed ? (
        <div className={styles.fallback} role="status">
          <p className={styles.fallbackPunchline}>{dictionary.mapUnavailablePunchline}</p>
          <p className={styles.fallbackExplanation}>{dictionary.mapUnavailableExplanation}</p>
          <button
            type="button"
            className={styles.fallbackRetry}
            onClick={() => {
              setTilesFailed(false);
              setAttempt((value) => value + 1);
            }}
          >
            {dictionary.mapUnavailableRetry}
          </button>
        </div>
      ) : (
        <div
          ref={containerRef}
          className={styles.map}
          role="region"
          aria-label={dictionary.mapAccessibleLabel}
        />
      )}

      <button
        type="button"
        className={styles.viewToggle}
        onClick={() => setViewMode((mode) => (mode === 'map' ? 'list' : 'map'))}
      >
        {viewMode === 'map' ? dictionary.viewToggleToList : dictionary.viewToggleToMap}
      </button>

      {(locationFlow === 'granted' || locationFlow === 'dismissed') && (
        <button
          type="button"
          className={styles.filtersToggle}
          onClick={() => {
            setDraftFilters(activeFilters);
            setFiltersOpen(true);
          }}
        >
          {dictionary.filtersToggleLabel}
        </button>
      )}

      {(locationFlow === 'granted' || locationFlow === 'dismissed') &&
        (selectedToilet ? (
          <ToiletDetailSheet
            toilet={selectedToilet}
            dictionary={dictionary}
            onClose={() => setSelectedId(null)}
          />
        ) : noResultsVisible ? (
          <NoResultsState
            dictionary={dictionary}
            hasActiveFilters={Object.keys(activeFilters).length > 0}
            radiusAtMax={searchRadius >= MAX_RADIUS_METERS}
            fill={viewMode === 'list'}
            onClearFilters={() => {
              setDraftFilters({});
              setActiveFilters({});
            }}
            onExpandRadius={() => setSearchRadius(MAX_RADIUS_METERS)}
            onDismiss={() => setDismissedParams(currentSearchParams)}
          />
        ) : (
          viewMode === 'map' &&
          recommendedToilet && (
            <NearestToiletPreview
              toilet={recommendedToilet}
              dictionary={dictionary}
              onSelect={() => selectToilet(recommendedToilet.id)}
            />
          )
        ))}

      {filtersOpen && (
        <FiltersSheet
          filters={draftFilters}
          dictionary={dictionary}
          onChange={setDraftFilters}
          onApply={() => {
            setActiveFilters(draftFilters);
            setFiltersOpen(false);
          }}
          onClear={() => {
            setDraftFilters({});
            setActiveFilters({});
            setFiltersOpen(false);
          }}
          onClose={() => setFiltersOpen(false)}
        />
      )}

      {(locationFlow === 'asking' || locationFlow === 'requesting') && (
        <div className={styles.scrim}>
          <div
            className={styles.sheet}
            role="dialog"
            aria-modal="false"
            aria-labelledby="location-ask-headline"
          >
            <h2
              id="location-ask-headline"
              ref={askHeadingRef}
              tabIndex={-1}
              className={styles.sheetHeadline}
            >
              {dictionary.locationAskHeadline}
            </h2>
            <p className={styles.sheetBody}>{dictionary.locationAskBody}</p>
            <p className={styles.sheetPrivacyHint}>{dictionary.locationAskPrivacyHint}</p>
            <button
              type="button"
              className={styles.sheetPrimary}
              disabled={locationFlow === 'requesting'}
              onClick={handleShareLocation}
            >
              {dictionary.locationAskAllow}
            </button>
            <button
              type="button"
              className={styles.sheetSecondary}
              disabled={locationFlow === 'requesting'}
              onClick={() => setLocationFlow('dismissed')}
            >
              {dictionary.locationAskSkip}
            </button>
          </div>
        </div>
      )}

      {locationFlow === 'denied' && (
        <div className={styles.scrim}>
          <div
            className={styles.sheet}
            role="dialog"
            aria-modal="false"
            aria-labelledby="location-denied-headline"
          >
            <h2
              id="location-denied-headline"
              ref={deniedHeadingRef}
              tabIndex={-1}
              className={styles.sheetHeadline}
            >
              {dictionary.locationDeniedHeadline}
            </h2>
            <p className={styles.sheetBody}>{dictionary.locationDeniedBody}</p>
            <button type="button" className={styles.sheetPrimary} onClick={handleShareLocation}>
              {dictionary.locationDeniedRetry}
            </button>
            <button
              type="button"
              className={styles.sheetSecondary}
              onClick={() => setLocationFlow('dismissed')}
            >
              {dictionary.locationDeniedOpenMap}
            </button>
          </div>
        </div>
      )}

      {locationFlow === 'outside' && (
        <div className={styles.scrim}>
          <div
            className={styles.sheet}
            role="dialog"
            aria-modal="false"
            aria-labelledby="location-outside-headline"
          >
            <h2
              id="location-outside-headline"
              ref={outsideHeadingRef}
              tabIndex={-1}
              className={styles.sheetHeadline}
            >
              {dictionary.outsideWarsawHeadline}
            </h2>
            <p className={styles.sheetBody}>{dictionary.outsideWarsawBody}</p>
            <button
              type="button"
              className={styles.sheetPrimary}
              onClick={() => setLocationFlow('dismissed')}
            >
              {dictionary.locationDeniedOpenMap}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
