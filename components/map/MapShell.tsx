'use client';

import { useEffect, useRef, useState } from 'react';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { requestLocation, type LocationResult } from '@/lib/geolocation/request-location';
import { buildMapStyleUrl } from '@/lib/map/tile-provider';
import {
  WARSAW_CENTER,
  WARSAW_CENTER_LAT,
  WARSAW_CENTER_LNG,
  WARSAW_DEFAULT_ZOOM,
  WARSAW_MAX_BOUNDS,
} from '@/lib/map/warsaw-view';
import { fetchNearbyToilets } from '@/lib/toilets/fetch-nearby';
import { diffMarkers } from '@/lib/toilets/marker-diff';
import { createToiletMarkerElement, setMarkerSelected } from '@/lib/toilets/marker-element';
import type { NearbyToiletResult } from '@/lib/toilets/nearby-response';
import { NearestToiletPreview } from './NearestToiletPreview';
import styles from './MapShell.module.css';

/**
 * The Warsaw map shell (TASK-005), the location permission flow (TASK-006),
 * nearby toilet markers with click-to-select (TASK-008), and the collapsed
 * nearest-toilet preview (TASK-010, reading the API's now-ranked order from
 * TASK-009). No detail sheet, no filters, no list view — those are later
 * tasks.
 *
 * When no tile provider key is configured, `maplibre-gl` is never imported or
 * initialised. The component renders the literal fallback state instead, per
 * `docs/adr/0005-map-tile-provider.md`. This is not a stub: every environment
 * without a configured key, including a misconfigured production one, needs
 * exactly this behaviour rather than a blank area.
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
 */
type LocationFlowState = 'asking' | 'requesting' | 'granted' | 'denied' | 'dismissed';

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
  const askHeadingRef = useRef<HTMLHeadingElement>(null);
  const deniedHeadingRef = useRef<HTMLHeadingElement>(null);

  // NEXT_PUBLIC_ variables must be referenced literally for Next.js to inline
  // them at build time; wrapping this read in a helper would leave it empty.
  const styleUrl = buildMapStyleUrl(process.env.NEXT_PUBLIC_MAPTILER_KEY);

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

    // Imported dynamically so the ~200 KB library is never fetched, and never
    // touches the DOM, on the fallback path.
    import('maplibre-gl')
      .then(({ Map: MapLibreMap, NavigationControl }) => {
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
  }, [locationFlow]);

  // Fetches nearby toilets on mount, centred on the default Warsaw view, and
  // again whenever the user grants a real location. This is independent of
  // whether the map itself has loaded: PRODUCT.md section 6.1 requires the
  // manual-browse journey to be useful even without a grant, and an empty
  // map with no toilets until location is shared would be a weak version of
  // that. Rendering the results as markers is a separate effect below.
  useEffect(() => {
    let cancelled = false;
    const center = grantedCoords ?? { lat: WARSAW_CENTER_LAT, lon: WARSAW_CENTER_LNG };

    fetchNearbyToilets({ lat: center.lat, lng: center.lon }).then((result) => {
      if (!cancelled && result.ok) setToilets(result.results);
    });

    return () => {
      cancelled = true;
    };
  }, [grantedCoords]);

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
          () => setSelectedId(toilet.id),
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
      await addUserLocationMarker(result);
      setLocationFlow('granted');
      setGrantedCoords({ lat: result.coords.lat, lon: result.coords.lon });
      return;
    }

    // Every non-grant outcome (denied, unavailable, timeout, error) shares
    // one screen; BRAND.md and DESIGN.md give one copy variant for all of
    // them, not one each.
    setLocationFlow('denied');
  }

  return (
    <div className={styles.mapWrapper}>
      {!styleUrl || tilesFailed ? (
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

      {(locationFlow === 'granted' || locationFlow === 'dismissed') && toilets[0] && (
        <NearestToiletPreview toilet={toilets[0]} dictionary={dictionary} />
      )}

      {(locationFlow === 'asking' || locationFlow === 'requesting') && (
        <div className={styles.scrim}>
          <div className={styles.sheet} role="dialog" aria-modal="false">
            <h2 ref={askHeadingRef} tabIndex={-1} className={styles.sheetHeadline}>
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
          <div className={styles.sheet} role="dialog" aria-modal="false">
            <h2 ref={deniedHeadingRef} tabIndex={-1} className={styles.sheetHeadline}>
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
    </div>
  );
}
