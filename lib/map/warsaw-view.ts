import { WARSAW_BBOX } from '@/lib/geo/warsaw';
import type { LngLatBoundsLike, LngLatLike } from 'maplibre-gl';

/**
 * The initial camera and pan limits for the Warsaw map shell.
 *
 * Reuses the coarse bounding box already defined for ingestion rather than
 * introducing a second, possibly diverging, definition of "Warsaw" for the
 * map. See `lib/geo/warsaw.ts` for why that box is coarse and provisional.
 */

/** Plain numbers, reused by the nearby-toilets fetch trigger (TASK-008),
 * which needs `lat`/`lng` directly rather than MapLibre's `LngLatLike`
 * union, some members of which are not object-shaped. */
export const WARSAW_CENTER_LAT = 52.2297;
export const WARSAW_CENTER_LNG = 21.0122;

export const WARSAW_CENTER: LngLatLike = { lng: WARSAW_CENTER_LNG, lat: WARSAW_CENTER_LAT };

/** City-wide overview. Chosen so central and most outer districts both fit. */
export const WARSAW_DEFAULT_ZOOM = 11;

/** [west, south, east, north], the order MapLibre's LngLatBounds expects. */
export const WARSAW_MAX_BOUNDS: LngLatBoundsLike = [
  WARSAW_BBOX.west,
  WARSAW_BBOX.south,
  WARSAW_BBOX.east,
  WARSAW_BBOX.north,
];
