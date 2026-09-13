import { WARSAW_BBOX } from '@/lib/geo/warsaw';
import type { LngLatBoundsLike, LngLatLike } from 'maplibre-gl';

/**
 * The initial camera and pan limits for the Warsaw map shell.
 *
 * Reuses the coarse bounding box already defined for ingestion rather than
 * introducing a second, possibly diverging, definition of "Warsaw" for the
 * map. See `lib/geo/warsaw.ts` for why that box is coarse and provisional.
 */

export const WARSAW_CENTER: LngLatLike = { lng: 21.0122, lat: 52.2297 };

/** City-wide overview. Chosen so central and most outer districts both fit. */
export const WARSAW_DEFAULT_ZOOM = 11;

/** [west, south, east, north], the order MapLibre's LngLatBounds expects. */
export const WARSAW_MAX_BOUNDS: LngLatBoundsLike = [
  WARSAW_BBOX.west,
  WARSAW_BBOX.south,
  WARSAW_BBOX.east,
  WARSAW_BBOX.north,
];
