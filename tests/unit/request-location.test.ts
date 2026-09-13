import { describe, expect, it, vi } from 'vitest';
import { requestLocation } from '@/lib/geolocation/request-location';

/**
 * Every branch of the classification, driven by a fake `Geolocation` object
 * rather than a real browser API, per PRODUCT.md FR-02's four outcomes.
 */
function fakeGeolocation(
  behavior: (success: PositionCallback, error: PositionErrorCallback | undefined) => void,
): Geolocation {
  return {
    getCurrentPosition: behavior,
    watchPosition: vi.fn(),
    clearWatch: vi.fn(),
  } as unknown as Geolocation;
}

function fakeError(code: number, message: string): GeolocationPositionError {
  return {
    code,
    message,
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3,
  } as GeolocationPositionError;
}

describe('requestLocation', () => {
  it('resolves unavailable immediately when there is no geolocation API, without calling it', async () => {
    const result = await requestLocation(undefined);

    expect(result).toEqual({ status: 'unavailable', message: 'Geolocation API not available' });
  });

  it('resolves granted with coordinates and accuracy on success', async () => {
    const geolocation = fakeGeolocation((success) => {
      success({
        coords: { latitude: 52.2297, longitude: 21.0122, accuracy: 15 },
      } as GeolocationPosition);
    });

    const result = await requestLocation(geolocation);

    expect(result).toEqual({
      status: 'granted',
      coords: { lat: 52.2297, lon: 21.0122, accuracyMeters: 15 },
    });
  });

  it('classifies PERMISSION_DENIED as denied', async () => {
    const geolocation = fakeGeolocation((_success, error) => {
      error?.(fakeError(1, 'User denied Geolocation'));
    });

    expect(await requestLocation(geolocation)).toEqual({
      status: 'denied',
      message: 'User denied Geolocation',
    });
  });

  it('classifies POSITION_UNAVAILABLE as unavailable', async () => {
    const geolocation = fakeGeolocation((_success, error) => {
      error?.(fakeError(2, 'Position unavailable'));
    });

    expect(await requestLocation(geolocation)).toEqual({
      status: 'unavailable',
      message: 'Position unavailable',
    });
  });

  it('classifies TIMEOUT as timeout', async () => {
    const geolocation = fakeGeolocation((_success, error) => {
      error?.(fakeError(3, 'Timed out'));
    });

    expect(await requestLocation(geolocation)).toEqual({ status: 'timeout', message: 'Timed out' });
  });

  it('classifies an unrecognised error code as error rather than guessing a known one', async () => {
    const geolocation = fakeGeolocation((_success, error) => {
      error?.(fakeError(99, 'Something unexpected'));
    });

    expect(await requestLocation(geolocation)).toEqual({
      status: 'error',
      message: 'Something unexpected',
    });
  });

  it('requests a fresh, high-accuracy fix rather than a cached or coarse one', async () => {
    const getCurrentPosition = vi.fn();
    const geolocation = { getCurrentPosition } as unknown as Geolocation;

    void requestLocation(geolocation);

    expect(getCurrentPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      expect.objectContaining({ enableHighAccuracy: true, maximumAge: 0 }),
    );
  });
});
