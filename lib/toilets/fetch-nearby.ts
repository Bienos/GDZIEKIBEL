import type { NearbyToiletResult } from './nearby-response';

/**
 * Client-side call to `POST /api/toilets/nearby`. Never throws; every
 * failure — network, non-2xx, or an unexpected body shape — resolves to a
 * typed failure so a caller cannot forget to handle it.
 */

export interface FetchNearbyParams {
  lat: number;
  lng: number;
}

export type FetchNearbyResult =
  { ok: true; results: NearbyToiletResult[] } | { ok: false; message: string };

export async function fetchNearbyToilets(
  params: FetchNearbyParams,
  fetchImpl: typeof fetch = fetch,
): Promise<FetchNearbyResult> {
  try {
    const response = await fetchImpl('/api/toilets/nearby', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location: { lat: params.lat, lng: params.lng } }),
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
