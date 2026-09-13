/**
 * Builds a Google Maps walking-directions URL to a toilet's own
 * coordinates. Destination-only: the function's only input is the
 * destination, so the user's own granted location has no parameter through
 * which it could ever appear in the generated URL, satisfying
 * `ARCHITECTURE.md` section 12's "do not embed private user coordinates
 * into shareable URLs unnecessarily." See
 * `docs/adr/0008-external-navigation-url.md` for the provider choice.
 */
export function buildWalkingNavigationUrl(destination: { lat: number; lng: number }): string {
  const params = new URLSearchParams({
    api: '1',
    destination: `${destination.lat},${destination.lng}`,
    travelmode: 'walking',
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
