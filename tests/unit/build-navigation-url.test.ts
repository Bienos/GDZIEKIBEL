import { describe, expect, it } from 'vitest';
import { buildWalkingNavigationUrl } from '@/lib/external-navigation/build-navigation-url';

describe('buildWalkingNavigationUrl', () => {
  it('builds a Google Maps walking-directions URL to the destination', () => {
    const url = buildWalkingNavigationUrl({ lat: 52.2297, lng: 21.0122 });

    expect(url).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=52.2297%2C21.0122&travelmode=walking',
    );
  });

  it('always requests the walking travel mode', () => {
    const url = buildWalkingNavigationUrl({ lat: 0, lng: 0 });

    expect(new URL(url).searchParams.get('travelmode')).toBe('walking');
  });

  it('sets only the destination, never an origin — the user’s own location has no parameter to appear in', () => {
    const url = buildWalkingNavigationUrl({ lat: 52.25, lng: 21.05 });
    const params = new URL(url).searchParams;

    expect(params.get('destination')).toBe('52.25,21.05');
    expect(params.has('origin')).toBe(false);
  });
});
