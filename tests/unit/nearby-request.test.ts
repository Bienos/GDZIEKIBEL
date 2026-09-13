import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RADIUS_METERS,
  MAX_RADIUS_METERS,
  parseNearbyRequest,
} from '@/lib/toilets/nearby-request';

describe('parseNearbyRequest', () => {
  it('accepts a valid location with no radius, defaulting it', () => {
    const result = parseNearbyRequest({ location: { lat: 52.2297, lng: 21.0122 } });

    expect(result).toEqual({
      ok: true,
      params: { lat: 52.2297, lng: 21.0122, radiusMeters: DEFAULT_RADIUS_METERS },
    });
  });

  it('accepts a valid radius under the cap unchanged', () => {
    const result = parseNearbyRequest({
      location: { lat: 52.2297, lng: 21.0122 },
      radiusMeters: 800,
    });

    expect(result).toEqual({ ok: true, params: { lat: 52.2297, lng: 21.0122, radiusMeters: 800 } });
  });

  it('clamps a radius above the server-controlled maximum rather than rejecting it', () => {
    const result = parseNearbyRequest({
      location: { lat: 52.2297, lng: 21.0122 },
      radiusMeters: 999_999,
    });

    expect(result).toEqual({
      ok: true,
      params: { lat: 52.2297, lng: 21.0122, radiusMeters: MAX_RADIUS_METERS },
    });
  });

  it('rejects an out-of-range latitude without echoing the value', () => {
    const result = parseNearbyRequest({ location: { lat: 91, lng: 21.0122 } });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain('location.lat');
    expect(result.message).not.toContain('91');
  });

  it('rejects an out-of-range longitude', () => {
    expect(parseNearbyRequest({ location: { lat: 52.2297, lng: 181 } }).ok).toBe(false);
  });

  it('rejects a non-positive radius', () => {
    expect(
      parseNearbyRequest({ location: { lat: 52.2297, lng: 21.0122 }, radiusMeters: 0 }).ok,
    ).toBe(false);
    expect(
      parseNearbyRequest({ location: { lat: 52.2297, lng: 21.0122 }, radiusMeters: -5 }).ok,
    ).toBe(false);
  });

  it('rejects a missing location entirely', () => {
    expect(parseNearbyRequest({}).ok).toBe(false);
    expect(parseNearbyRequest(null).ok).toBe(false);
    expect(parseNearbyRequest('not an object').ok).toBe(false);
  });

  it('rejects an unrecognised field rather than silently ignoring it, including filters', () => {
    // filters is not implemented yet (ADR 0006); a client sending it should
    // learn that now, not believe it was applied.
    const result = parseNearbyRequest({
      location: { lat: 52.2297, lng: 21.0122 },
      filters: { openNow: true },
    });

    expect(result.ok).toBe(false);
  });
});
