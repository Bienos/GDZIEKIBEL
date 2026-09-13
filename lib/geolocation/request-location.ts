/**
 * Wraps the browser Geolocation API in a single promise that always resolves,
 * never rejects, and classifies every outcome `PRODUCT.md` FR-02 requires:
 * granted, denied, unavailable, timeout, or an unexpected error.
 *
 * Kept apart from any React code so the classification can be unit tested
 * without a DOM or a real `navigator.geolocation`.
 */

export interface LocationGranted {
  status: 'granted';
  coords: { lat: number; lon: number; accuracyMeters: number };
}

export interface LocationNotGranted {
  status: 'denied' | 'unavailable' | 'timeout' | 'error';
  /** The raw browser message, kept for diagnostics only. Never shown to the
   * user as-is: the UI uses one shared copy variant for every non-granted
   * outcome, per `BRAND.md` and `DESIGN.md`. */
  message: string | null;
}

export type LocationResult = LocationGranted | LocationNotGranted;

/**
 * A stale cached fix is not acceptable for "find the nearest toilet now".
 * The distance this app promises is only as good as the fix it is built on,
 * so accuracy is asked for even at some cost to how quickly it resolves.
 */
const GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10_000,
  maximumAge: 0,
};

function classifyError(error: GeolocationPositionError): LocationNotGranted {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return { status: 'denied', message: error.message || null };
    case error.POSITION_UNAVAILABLE:
      return { status: 'unavailable', message: error.message || null };
    case error.TIMEOUT:
      return { status: 'timeout', message: error.message || null };
    default:
      return { status: 'error', message: error.message || null };
  }
}

/**
 * Requests the user's position once. Resolves `unavailable` immediately,
 * without touching the API, when the browser has no `navigator.geolocation`
 * at all — an old browser, or a context the platform considers insecure.
 */
export function requestLocation(
  geolocation: Geolocation | undefined = typeof navigator === 'undefined'
    ? undefined
    : navigator.geolocation,
): Promise<LocationResult> {
  if (!geolocation) {
    return Promise.resolve({ status: 'unavailable', message: 'Geolocation API not available' });
  }

  return new Promise((resolve) => {
    geolocation.getCurrentPosition(
      (position) => {
        resolve({
          status: 'granted',
          coords: {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
            accuracyMeters: position.coords.accuracy,
          },
        });
      },
      (error) => resolve(classifyError(error)),
      GEOLOCATION_OPTIONS,
    );
  });
}
