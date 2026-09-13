import type { NearbyFilters } from './filter-nearby';
import type { NearbyToiletResult } from './nearby-response';

/**
 * Client-side call to `POST /api/toilets/nearby`. Never throws; every
 * failure — network, non-2xx, or an unexpected body shape — resolves to a
 * typed failure so a caller cannot forget to handle it.
 */

export interface FetchNearbyParams {
  lat: number;
  lng: number;
  /** Omitted (or `{}`) when no filter is active — the request body then
   * carries no `filters` key at all, matching pre-`TASK-016` requests. */
  filters?: NearbyFilters;
  /** Omitted to let the server apply `DEFAULT_RADIUS_METERS`. `TASK-017`'s
   * "search farther" action sends `MAX_RADIUS_METERS` explicitly. */
  radiusMeters?: number;
}

export type FetchNearbyResult =
  { ok: true; results: NearbyToiletResult[] } | { ok: false; message: string };

export async function fetchNearbyToilets(
  params: FetchNearbyParams,
  fetchImpl: typeof fetch = fetch,
): Promise<FetchNearbyResult> {
  try {
    const hasFilters = params.filters && Object.keys(params.filters).length > 0;
    const response = await fetchImpl('/api/toilets/nearby', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        location: { lat: params.lat, lng: params.lng },
        ...(hasFilters ? { filters: params.filters } : {}),
        ...(params.radiusMeters !== undefined ? { radiusMeters: params.radiusMeters } : {}),
      }),
    });

    if (!response.ok) {
      return { ok: false, message: `Request failed with status ${response.status}` };
    }

    const data: unknown = await response.json();
    const results = (data as { results?: unknown }).results;
    if (!Array.isArray(results)) {
      return { ok: false, message: 'Response did not contain a results array' };
    }

    return { ok: true, results: results as NearbyToiletResult[] };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}
