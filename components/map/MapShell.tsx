'use client';

import { useEffect, useRef, useState } from 'react';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { requestLocation, type LocationResult } from '@/lib/geolocation/request-location';
import { buildMapStyleUrl } from '@/lib/map/tile-provider';
import { WARSAW_CENTER, WARSAW_DEFAULT_ZOOM, WARSAW_MAX_BOUNDS } from '@/lib/map/warsaw-view';
import styles from './MapShell.module.css';

/**
 * The Warsaw map shell (TASK-005) plus the location permission flow
 * (TASK-006). No toilet markers, ranking, or bottom sheet yet — those are
 * later tasks.
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
  const [tilesFailed, setTilesFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [locationFlow, setLocationFlow] = useState<LocationFlowState>('asking');
  const askHeadingRef = useRef<HTMLHeadingElement>(null);
  const deniedHeadingRef = useRef<HTMLHeadingElement>(null);

  // NEXT_PUBLIC_ variables must be referenced literally for Next.js to inline
  // them at build time; wrapping this read in a helper would leave it empty.
  const styleUrl = buildMapStyleUrl(process.env.NEXT_PUBLIC_MAPTILER_KEY);

  useEffect(() => {
    if (!styleUrl || !containerRef.current) return;

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
      map?.remove();
    };
  }, [styleUrl, attempt]);

  useEffect(() => {
    if (locationFlow === 'asking') askHeadingRef.current?.focus();
    if (locationFlow === 'denied') deniedHeadingRef.current?.focus();
  }, [locationFlow]);

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
