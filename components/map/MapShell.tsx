'use client';

import { useEffect, useRef, useState } from 'react';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { buildMapStyleUrl } from '@/lib/map/tile-provider';
import { WARSAW_CENTER, WARSAW_DEFAULT_ZOOM, WARSAW_MAX_BOUNDS } from '@/lib/map/warsaw-view';
import styles from './MapShell.module.css';

/**
 * The Warsaw map shell. TASK-005 scope only: no geolocation, no markers, no
 * bottom sheet. See `tasks/005-render-map-shell.md`.
 *
 * When no tile provider key is configured, `maplibre-gl` is never imported or
 * initialised. The component renders the literal fallback state instead, per
 * `docs/adr/0005-map-tile-provider.md`. This is not a stub: every environment
 * without a configured key, including a misconfigured production one, needs
 * exactly this behaviour rather than a blank area.
 */
export function MapShell({ dictionary }: { dictionary: Dictionary }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

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
        });
        // A single failed tile after a successful load is not fatal to the
        // shell; only failing before the map ever loads means the style or
        // key is bad, or the provider is unreachable.
        map.on('error', () => {
          if (!cancelled && !hasLoaded) setFailed(true);
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [styleUrl, attempt]);

  if (!styleUrl || failed) {
    return (
      <div className={styles.fallback} role="status">
        <p className={styles.fallbackPunchline}>{dictionary.mapUnavailablePunchline}</p>
        <p className={styles.fallbackExplanation}>{dictionary.mapUnavailableExplanation}</p>
        <button
          type="button"
          className={styles.fallbackRetry}
          onClick={() => {
            setFailed(false);
            setAttempt((value) => value + 1);
          }}
        >
          {dictionary.mapUnavailableRetry}
        </button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={styles.map}
      role="region"
      aria-label={dictionary.mapAccessibleLabel}
    />
  );
}
