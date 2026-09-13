import { describe, expect, it, vi } from 'vitest';
import { fetchNearbyToilets } from '@/lib/toilets/fetch-nearby';

function fakeFetch(response: Partial<Response> & { jsonBody?: unknown }): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: response.ok ?? true,
    status: response.status ?? 200,
    json: async () => response.jsonBody,
  }) as unknown as typeof fetch;
}

describe('fetchNearbyToilets', () => {
  it('posts to the nearby endpoint with the given coordinates', async () => {
    const fetchImpl = fakeFetch({ jsonBody: { results: [] } });

    await fetchNearbyToilets({ lat: 52.2297, lng: 21.0122 }, fetchImpl);

    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/toilets/nearby',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ location: { lat: 52.2297, lng: 21.0122 } }),
      }),
    );
  });

  it('resolves ok with the results array on success', async () => {
    const fetchImpl = fakeFetch({ jsonBody: { results: [{ id: 'a' }] } });

    const result = await fetchNearbyToilets({ lat: 52.2297, lng: 21.0122 }, fetchImpl);

    expect(result).toEqual({ ok: true, results: [{ id: 'a' }] });
  });

  it('resolves a typed failure on a non-2xx response, never throwing', async () => {
    const fetchImpl = fakeFetch({ ok: false, status: 500, jsonBody: {} });

    const result = await fetchNearbyToilets({ lat: 52.2297, lng: 21.0122 }, fetchImpl);

    expect(result).toEqual({ ok: false, message: 'Request failed with status 500' });
  });

  it('resolves a typed failure when the body has no results array', async () => {
    const fetchImpl = fakeFetch({ jsonBody: { error: 'something else' } });

    const result = await fetchNearbyToilets({ lat: 52.2297, lng: 21.0122 }, fetchImpl);

    expect(result.ok).toBe(false);
  });

  it('resolves a typed failure rather than throwing when fetch itself rejects', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValue(new Error('network down')) as unknown as typeof fetch;

    const result = await fetchNearbyToilets({ lat: 52.2297, lng: 21.0122 }, fetchImpl);

    expect(result).toEqual({ ok: false, message: 'network down' });
  });
});
