import { z } from 'zod';
import type { NearbyFilters } from './filter-nearby';

/**
 * Validates and normalises a `POST /api/toilets/nearby` request body.
 *
 * `filters` was deliberately withheld until this field could do something
 * (`docs/adr/0006-nearby-api-contract.md`); `TASK-016` gives it real
 * meaning (`docs/adr/0011-filter-semantics.md`).
 */

/** Used when the client sends no radius at all. */
export const DEFAULT_RADIUS_METERS = 1500;

/**
 * Server-controlled ceiling. A request above this is clamped, not rejected:
 * `ARCHITECTURE.md` section 7 requires the cap to exist, not that an
 * over-eager client be treated as an error.
 */
export const MAX_RADIUS_METERS = 5000;

const nearbyFiltersSchema = z.strictObject({
  openNow: z.boolean().optional(),
  free: z.boolean().optional(),
  wheelchairAccessible: z.boolean().optional(),
  babyChanging: z.boolean().optional(),
  open24h: z.boolean().optional(),
});

const nearbyRequestBodySchema = z.strictObject({
  location: z.strictObject({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
  radiusMeters: z.number().positive().finite().optional(),
  filters: nearbyFiltersSchema.optional(),
});

export interface NearbyQueryParams {
  lat: number;
  lng: number;
  radiusMeters: number;
  filters: NearbyFilters;
}

export type NearbyRequestValidation =
  { ok: true; params: NearbyQueryParams } | { ok: false; message: string };

/**
 * Never echoes the submitted coordinates in a failure message: only which
 * field was wrong and why, from the Zod issue itself.
 */
export function parseNearbyRequest(input: unknown): NearbyRequestValidation {
  const result = nearbyRequestBodySchema.safeParse(input);

  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path.join('.') || '(root)';
    return { ok: false, message: `${path}: ${issue?.message ?? 'invalid request body'}` };
  }

  const { location, radiusMeters, filters } = result.data;

  return {
    ok: true,
    params: {
      lat: location.lat,
      lng: location.lng,
      radiusMeters: Math.min(radiusMeters ?? DEFAULT_RADIUS_METERS, MAX_RADIUS_METERS),
      filters: filters ?? {},
    },
  };
}
